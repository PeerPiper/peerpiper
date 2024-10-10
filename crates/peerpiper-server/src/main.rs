#![feature(async_closure)]
#![allow(clippy::needless_return)]

#[cfg(feature = "cloudflare")]
mod cloudflare;

use anyhow::Result;
use axum::extract::State;
use axum::response::{Html, IntoResponse};
use axum::Router;
use axum::{http::Method, routing::get};
use futures::channel::{mpsc, oneshot};
use futures::StreamExt;
use libp2p::multiaddr::{Multiaddr, Protocol};
use peerpiper::core::events::{Events, PublicEvent};
use peerpiper::core::libp2p::api::Libp2pEvent;
use std::net::{Ipv4Addr, SocketAddr};
use tower_http::cors::{Any, CorsLayer};

const MAX_CHANNELS: usize = 16;

/// The plugins directory
const PLUGINS_DIR: &str = "./plugins";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "info,peerpiper_core=debug,interop_tests_native=debug,peerpiper_native=debug,libp2p_webrtc=off,libp2p_ping=debug,libp2p_gossipsub=info",
        )
        .try_init();

    tracing::info!("Starting peerpiper-server");

    let (tx, mut rx) = mpsc::channel(MAX_CHANNELS);
    let (_command_sender, command_receiver) = mpsc::channel(8);
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
    tokio::spawn(serve(address.clone()));

    let handle_new_address = async |address: &Multiaddr| {
        #[cfg(feature = "cloudflare")]
        if let Err(e) = cloudflare::add_address(address).await {
            tracing::error!("Could not add address to cloudflare DNS record: {e}");
        }
    };

    handle_new_address(&address).await;

    // TODO: Insert handler (WIT components) here.
    // let bytes = peerpiper::handler::utils::get_wasm_bytes("peerpiper_handler")?;
    // let handler = peerpiper::handler::Handler::new(bytes)?;

    // create new Extensions struct with a given wasm file
    // for now, use ../../../target/wasm32-wasip1/debug/extension_echo.wasm

    #[cfg(feature = "plugins")]
    async fn load_plugins(wasms: &[&str]) -> Option<peerpiper_plugins::tokio::Plugins> {
        let path = std::env::current_dir().ok()?;
        let mut plugins = peerpiper_plugins::tokio::PluginsBuilder::new().unwrap();
        // convert wasms to Paths, then use to load the wasm files
        for wasm in wasms.iter() {
            // join src/wasm
            let path = path.join("src").join(wasm);
            tracing::info!("Loading wasm file: {:?}", path);
            let wasm_bytes = std::fs::read(path).unwrap();
            plugins.with_wasm(wasm_bytes);
        }

        let runner = plugins.build().await.ok()?;
        Some(runner)
    }

    #[cfg(feature = "plugins")]
    let wasms = [
        "../../../target/wasm32-wasip1/debug/extension_echo.wasm",
        "../../../../bestsign/target/wasm32-wasip1/debug/plugin.wasm",
    ];
    #[cfg(feature = "plugins")]
    let mut plugs = load_plugins(&wasms).await;

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

                #[cfg(feature = "plugins")]
                {
                    // set up a loop over the plugins, and call handle_request on each
                    // then break loop and return the first Ok response,if Err keep looping
                    // until all plugins have been called
                    for plugin in plugs.iter_mut() {
                        if let Ok(bytes) = plugin.handle_request(request.to_vec()).await {
                            tracing::info!("Plugin output: {:?}", bytes);
                            client_handle.respond_bytes(bytes, channel).await?;
                            break;
                        }
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

    loop {
        tokio::select! {
            Some(msg) = rx.next() => {
                handle_event(msg).await?;
            }
            _ = tokio::signal::ctrl_c() => {
                tracing::info!("Received ctrl-c");
                break;
            }
        }
    }

    Ok(())
}

/// Serve the Multiaddr we are listening on and the host files.
pub(crate) async fn serve(libp2p_transport: Multiaddr) {
    let Some(Protocol::Ip6(_listen_addr)) = libp2p_transport.iter().next() else {
        panic!("Expected 1st protocol to be IP6")
    };

    // Serve the addr as a string over HTTP.
    let server = Router::new()
        .route("/", get(get_index))
        .route("/index.html", get(get_index))
        .with_state(Libp2pEndpoint(libp2p_transport))
        .layer(
            // allow cors
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET]),
        );

    // let addr = SocketAddr::new(listen_addr.into(), 8080);
    let addr = SocketAddr::new(std::net::IpAddr::V4(Ipv4Addr::LOCALHOST), 8080);

    tracing::info!(url=%format!("http://{addr}"), "Serving client files at url");

    tokio::spawn(async move {
        if let Err(e) = axum::Server::bind(&addr)
            .serve(server.into_make_service())
            .await
        {
            tracing::error!(%e, "Error serving client files");
        }
    });

    tracing::info!(url=%format!("http://{addr}"), "Opening browser");
}

#[derive(Clone)]
struct Libp2pEndpoint(Multiaddr);

/// Serves the libp2p_endpoint as plain text (no HTML) at '/' and  'index.html'
async fn get_index(
    State(Libp2pEndpoint(libp2p_endpoint)): State<Libp2pEndpoint>,
) -> impl IntoResponse {
    tracing::info!(%libp2p_endpoint, "Serving libp2p_endpoint");
    Html(libp2p_endpoint.to_string())
}
