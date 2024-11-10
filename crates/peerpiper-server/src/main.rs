#![feature(async_closure)]
#![allow(clippy::needless_return)]

#[cfg(feature = "cloudflare")]
mod cloudflare;
mod web_server;

use anyhow::Result;
use futures::channel::mpsc::Sender;
use futures::channel::{mpsc, oneshot};
use futures::{SinkExt as _, StreamExt};
use libp2p::multiaddr::{Multiaddr, Protocol};
use peerpiper::core::events::{Events, PeerPiperCommand, PublicEvent};
use peerpiper::core::libp2p::api::Libp2pEvent;
use peerpiper_plugins::tokio::Plugin;
use std::path::{Path, PathBuf};
use std::sync::Arc;

const MAX_CHANNELS: usize = 16;

/// The plugins directory
const PLUGINS_DIR: &str = "plugins";

#[derive(Debug, Clone)]
struct PluginsState {
    /// Name of the plugin
    name: String,

    /// Sender to send commands to PeerPiper
    pp_tx: Sender<PeerPiperCommand>,
}

impl PluginsState {
    pub(crate) fn new(name: String, pp_tx: Sender<PeerPiperCommand>) -> Self {
        Self { name, pp_tx }
    }
}

#[async_trait::async_trait]
impl peerpiper_plugins::tokio::Inner for PluginsState {
    async fn start_providing(&mut self, key: Vec<u8>) {
        // send to swarm via peerpiper transmitter
        match self
            .pp_tx
            .send(PeerPiperCommand::StartProviding { key: key.clone() })
            .await
        {
            Ok(_) => {
                tracing::info!("Started providing for key: {:?}", key);
            }
            Err(e) => {
                tracing::error!("Error sending command to peerpiper: {:?}", e);
            }
        }
    }

    async fn log(&mut self, _msg: String) {
        // tracing::info!("State: {:?} {:?}", key, value);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "info,peerpiper_core=debug,interop_tests_native=debug,peerpiper_native=debug,libp2p_webrtc=off,libp2p_ping=debug,libp2p_gossipsub=info",
        )
        .try_init();

    tracing::info!("Starting peerpiper-server");

    let (tx, mut rx) = mpsc::channel(MAX_CHANNELS);
    let (command_sender, command_receiver) = mpsc::channel(8);
    let tx_clone = tx.clone();
    let (tx_client, rx_client) = oneshot::channel();

    tokio::spawn(async move {
        peerpiper::start(tx_clone, command_receiver, tx_client)
            .await
            .unwrap();
    });

    // await on rx_client to get the client handle
    let mut client_handle = rx_client.await?;

    tracing::info!("Started.");

    let address = loop {
        if let Events::Outer(PublicEvent::ListenAddr { address, .. }) = rx.next().await.unwrap() {
            tracing::info!(%address, "RXD Address");
            break address;
        }
    };

    // Serve .wasm, .js and server multiaddress over HTTP on this address.
    tokio::spawn(web_server::serve(address.clone()));

    let handle_new_address = async |address: &Multiaddr| {
        #[cfg(feature = "cloudflare")]
        if let Err(e) = cloudflare::add_address(address).await {
            tracing::error!("Could not add address to cloudflare DNS record: {e}");
        }
    };

    handle_new_address(&address).await;

    // Use WIT component handlers here.
    let load_plugins =
        async |wasms: &[PathBuf]| -> Vec<peerpiper_plugins::tokio::Plugin<PluginsState>> {
            let mut plugins = Vec::new();

            // if env err, return emtpy vec from load_plugins() fn
            let Ok(env) = peerpiper_plugins::tokio::Environment::<PluginsState>::new(
                Path::new(PLUGINS_DIR).to_path_buf(),
            ) else {
                return plugins;
            };

            let Ok(path) = std::env::current_dir() else {
                return plugins;
            };

            // convert wasms to Paths, then use to load the wasm files
            for wasm in wasms.iter() {
                // join src/wasm
                let path = path.join(wasm);
                tracing::info!("Loading wasm file: {:?}", path);
                let wasm_bytes = std::fs::read(&path).unwrap();
                let Ok(plugin) = Plugin::new(
                    env.clone(),
                    path.file_stem()
                        .unwrap_or_default()
                        .to_str()
                        .unwrap_or_default(),
                    &wasm_bytes,
                    PluginsState::new(
                        wasm.file_stem().unwrap().to_string_lossy().to_string(),
                        command_sender.clone(),
                    ),
                )
                .await
                else {
                    continue;
                };
                plugins.push(plugin);
            }

            plugins
        };

    // every *.wasm file in the ./plugins directory, if any
    let wasms = match std::fs::read_dir(PLUGINS_DIR) {
        Ok(dir) => dir
            .filter_map(|entry| {
                let entry = entry.ok()?;
                let path = entry.path();
                if path.extension()?.to_str()? == "wasm" {
                    Some(path)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>(),
        Err(e) => {
            // just return empty vec if error reading plugins directory
            tracing::error!("Error reading plugins directory: {:?}", e);
            Vec::new()
        }
    };

    let mut plugins = load_plugins(&wasms).await;

    let mut handle_event = async |msg| -> Result<(), Box<dyn std::error::Error>> {
        match msg {
            Events::Outer(
                ref m @ PublicEvent::Message {
                    ref topic,
                    ref peer,
                    ref data,
                },
            ) => {
                tracing::info!(
                    "Received msg on topic {:?} from peer: {:?}, {:?}",
                    topic,
                    peer,
                    data
                );
            }
            Events::Inner(Libp2pEvent::InboundRequest { request, channel }) => {
                tracing::trace!("InboundRequest: {:?}", request);

                // set up a loop over the plugins, and call handle_request on each
                // then break loop and return the first Ok response,if Err keep looping
                // until all plugins have been called
                for plugin in &mut plugins {
                    if let Ok(bytes) = plugin.handle_request(request.to_vec()).await {
                        tracing::info!("Plugin output: {:?}", bytes);
                        client_handle.respond_bytes(bytes, channel).await?;
                        break;
                    }
                }
            }
            Events::Outer(PublicEvent::ListenAddr { address: _, .. }) => {
                // TODO: Figure out what we want to do with the other new addresses.
                //handle_new_address(&address).await;
            }
            _ => {}
        }
        Ok(())
    };

    #[cfg(unix)]
    let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;

    loop {
        #[cfg(unix)]
        let sigterm_fut = sigterm.recv();
        #[cfg(not(unix))]
        let sigterm_fut = std::future::pending::<()>();

        tokio::select! {
            Some(msg) = rx.next() => {
                if let Err(e) = handle_event(msg).await {
                    tracing::error!(%e, "Error handling event");
                }
            }
            _ = tokio::signal::ctrl_c() => {
                tracing::info!("Received ctrl-c");
                break;
            }
            _ = sigterm_fut => {
                tracing::info!("Received SIGTERM");
                break;
            }
        }
    }

    tracing::info!("Shutting down...");

    Ok(())
}
