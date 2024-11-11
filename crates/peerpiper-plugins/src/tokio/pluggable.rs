use anyhow::Result;
use futures::channel::mpsc::Sender;
use futures::channel::{mpsc, oneshot};
use futures::SinkExt as _;
use futures::StreamExt as _;
use peerpiper::core::events::{Events, PeerPiperCommand, PublicEvent};
use peerpiper::core::libp2p::api::{Client, Libp2pEvent};
use std::collections::HashMap;
use std::path::Path;

use super::plugin::{Environment, Plugin};

#[derive(Debug, Clone)]
pub struct PluginsState {
    /// Name of the plugin
    name: String,

    /// Sender to send commands to PeerPiper
    command_sender: Sender<PeerPiperCommand>,

    /// An emitter to broadcast events
    evt_emitter: tokio::sync::mpsc::Sender<String>,
}

impl PluginsState {
    pub(crate) fn new(
        name: String,
        command_sender: Sender<PeerPiperCommand>,
        evt_emitter: tokio::sync::mpsc::Sender<String>,
    ) -> Self {
        Self {
            name,
            command_sender,
            evt_emitter,
        }
    }
}

#[async_trait::async_trait]
impl super::Inner for PluginsState {
    async fn start_providing(&mut self, key: Vec<u8>) {
        // send to swarm via peerpiper transmitter
        match self
            .command_sender
            .send(PeerPiperCommand::StartProviding { key: key.clone() })
            .await
        {
            Ok(_) => {
                tracing::info!("[{}] Started providing for key: {:?}", self.name, key);
            }
            Err(e) => {
                tracing::error!("Error sending command to peerpiper: {:?}", e);
            }
        }
    }

    async fn log(&mut self, msg: String) {
        // tracing::info!("State: {:?} {:?}", key, value);
        // state saved here, or in App, or both??
        // self.log.push(msg.clone());
        self.evt_emitter.send(msg).await.unwrap();
    }
}

/// PluginsManager holds the plugins state in memory.
pub struct PluggablePiper {
    pub(crate) plugins: HashMap<String, Plugin<PluginsState>>,
    plugin_receiver: mpsc::Receiver<Plugin<PluginsState>>,
    client_handle: Option<Client>,
    evt_emitter: tokio::sync::mpsc::Sender<String>,
}

impl PluggablePiper {
    /// Creates a new [PluggablePiper] by spawning a new peerpiper service
    /// and returning a handle to it.
    pub fn new() -> (
        Self,
        mpsc::Receiver<PeerPiperCommand>,
        PluginLoader,
        tokio::sync::mpsc::Receiver<String>,
    ) {
        let (plugin_sender, plugin_receiver) = mpsc::channel(8);
        let (command_sender, command_receiver) = mpsc::channel(8);
        let (evt_emitter, plugin_evts) = tokio::sync::mpsc::channel(100);

        (
            Self {
                plugins: Default::default(),
                plugin_receiver,
                client_handle: None,
                evt_emitter: evt_emitter.clone(),
            },
            command_receiver,
            PluginLoader::new(plugin_sender, command_sender, evt_emitter),
            plugin_evts,
        )
    }

    /// Runs the peerpiper service on the given plugin manager
    pub async fn run(
        &mut self,
        command_receiver: mpsc::Receiver<PeerPiperCommand>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        tracing::debug!("Running");

        let (tx_client, rx_client) = oneshot::channel();
        let (tx_events, mut rx_events) = mpsc::channel(16);

        tokio::spawn(async move {
            peerpiper::start(tx_events, command_receiver, tx_client)
                .await
                .unwrap();
        });

        // await on rx_client to get the client handle
        self.client_handle = Some(rx_client.await?);

        let _address = loop {
            if let Events::Outer(PublicEvent::ListenAddr { address, .. }) =
                rx_events.next().await.unwrap()
            {
                let msg = format!("RXD Address: {:?}", address);
                tracing::info!("{}", msg);
                self.evt_emitter.send(msg).await.unwrap();
                break address;
            }
        };

        // TODO: Cloudlfare from here?
        // let handle_new_address = async |address: &Multiaddr| {
        //     #[cfg(feature = "cloudflare")]
        //     if let Err(e) = cloudflare::add_address(address).await {
        //         tracing::error!("Could not add address to cloudflare DNS record: {e}");
        //     }
        // };
        //
        // handle_new_address(&address).await;

        loop {
            tokio::select! {
                Some(msg) = rx_events.next() => {
                    if let Err(e) = self.handle_event(msg).await {
                        tracing::error!(%e, "Error handling event");
                    }
                }
                // also select to recieve plugins from the [Loader]
                Some(plugin) = self.plugin_receiver.next() => {
                    let msg = format!("Plugin loaded: {:?}", plugin.state().name);
                    tracing::debug!("{}", msg);
                    self.plugins.insert(plugin.state().name.clone(), plugin);
                    self.evt_emitter.send(msg).await.unwrap();
                }
            }
        }
    }

    /// Uses the [Plugin]s to handle the given event
    async fn handle_event(&mut self, msg: Events) -> Result<(), Box<dyn std::error::Error>> {
        match msg {
            Events::Outer(
                ref _m @ PublicEvent::Message {
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
                for (name, plugin) in &mut self.plugins {
                    if let Ok(bytes) = plugin.handle_request(request.to_vec()).await {
                        let msg = format!("[{}] Plugin output: {:?}", name, bytes.len());
                        tracing::debug!("{}", msg);
                        self.evt_emitter.send(msg).await.unwrap();
                        self.client_handle
                            .as_mut()
                            .unwrap()
                            .respond_bytes(bytes, channel)
                            .await?;
                        break;
                    }
                }
            }
            Events::Outer(PublicEvent::ListenAddr { address, .. }) => {
                let msg = format!("👉 👉 Added {}", address);
                self.evt_emitter.send(msg).await.unwrap();
                // TODO: Figure out what we want to do with the other new addresses.
                //handle_new_address(&address).await;
            }
            _ => {}
        }
        Ok(())
    }

    // pub async fn load_plugin(
    //     &mut self,
    //     name: String,
    //     wasm_bytes: &[u8],
    // ) -> Result<(), Box<dyn std::error::Error>> {
    //     // if env err, return emtpy vec from load_plugins() fn
    //     let env = Environment::<PluginsState>::new(Path::new("plugins").to_path_buf())?;
    //
    //     // convert wasms to Paths, then use to load the wasm files
    //     let plugin = Plugin::new(
    //         env.clone(),
    //         &name.clone(),
    //         wasm_bytes,
    //         PluginsState::new(name, self.command_sender.as_ref().unwrap().clone()),
    //     )
    //     .await?;
    //
    //     self.plugins.push(plugin);
    //
    //     Ok(())
    // }
}

/// Loads plugins intot he Pluggable Piper
#[derive(Clone)]
pub struct PluginLoader {
    /// Command Sender to send commands to the Pluggable Piper
    command_sender: mpsc::Sender<PeerPiperCommand>,
    /// Plugin Sender to send plugins to the Pluggable Piper
    plugin_sender: mpsc::Sender<Plugin<PluginsState>>,
    /// Events emitted by the plugins
    evt_emitter: tokio::sync::mpsc::Sender<String>,
}

impl PluginLoader {
    /// Creates a new Loader
    pub fn new(
        plugin_sender: mpsc::Sender<Plugin<PluginsState>>,
        command_sender: mpsc::Sender<PeerPiperCommand>,
        evt_emitter: tokio::sync::mpsc::Sender<String>,
    ) -> Self {
        Self {
            plugin_sender,
            command_sender,
            evt_emitter,
        }
    }

    /// Loads the plugin by sending it to the [PluggablePiper]
    pub async fn load_plugin(
        &mut self,
        name: String,
        wasm_bytes: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let plugin = Plugin::new(
            Environment::<PluginsState>::new(Path::new("plugins").to_path_buf())?,
            &name.clone(),
            wasm_bytes,
            PluginsState::new(name, self.command_sender.clone(), self.evt_emitter.clone()),
        )
        .await?;

        self.plugin_sender.send(plugin).await?;

        Ok(())
    }
}
