use anyhow::Result;
use futures::channel::{mpsc, oneshot};
use futures::SinkExt as _;
use futures::StreamExt as _;
use libp2p::Multiaddr;
use peerpiper::core::events::{AllCommands, Events, PublicEvent};
use peerpiper::core::libp2p::api::{Client, Libp2pEvent, NetworkCommand};
use peerpiper::core::Commander;
use peerpiper_native::{NativeBlockstore, NativeBlockstoreBuilder};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use super::plugin::{Environment, Plugin};

#[derive(Debug, Clone)]
struct PluginsState {
    /// Name of the plugin
    name: String,

    /// Sender to send commands to PeerPiper
    commander: Arc<Mutex<Option<Commander<NativeBlockstore>>>>,

    /// An emitter to broadcast events
    evt_emitter: tokio::sync::mpsc::Sender<ExternalEvents>,
}

impl PluginsState {
    pub(crate) fn new(
        name: String,
        commander: Arc<Mutex<Option<Commander<NativeBlockstore>>>>,
        evt_emitter: tokio::sync::mpsc::Sender<ExternalEvents>,
    ) -> Self {
        Self {
            name,
            commander,
            evt_emitter,
        }
    }
}

#[async_trait::async_trait]
impl super::Inner for PluginsState {
    async fn start_providing(&mut self, key: Vec<u8>) {
        // send to swarm via peerpiper transmitter
        if let Some(commander) = self.commander.lock().await.as_mut() {
            if let Err(e) = commander
                .order(AllCommands::StartProviding { key: key.clone() })
                .await
            {
                tracing::error!("Error sending command to peerpiper: {:?}", e);
            }
        } else {
            tracing::error!("Commander not ready");
        }
    }

    async fn log(&mut self, msg: String) {
        // tracing::info!("State: {:?} {:?}", key, value);
        // state saved here, or in App, or both??
        // self.log.push(msg.clone());
        self.evt_emitter
            .send(ExternalEvents::Message(format!("[{}] {}", self.name, msg)))
            .await
            .unwrap();
    }
}

/// External Events emitted by Pluggable Piper
#[derive(Debug)]
pub enum ExternalEvents {
    /// Address added
    Address(Multiaddr),
    /// A generic message
    Message(String),
}

/// PluginsManager holds the plugins state in memory.
pub struct PluggablePiper {
    plugins: HashMap<String, Plugin<PluginsState>>,
    plugin_receiver: mpsc::Receiver<Plugin<PluginsState>>,
    client_handle: Option<Client>,
    evt_emitter: tokio::sync::mpsc::Sender<ExternalEvents>,
    /// Sender to send the client handle to the Commander Client
    client_sender: Option<tokio::sync::oneshot::Sender<Client>>,
}

impl PluggablePiper {
    /// Creates a new [PluggablePiper] by spawning a new peerpiper service
    /// and returning a handle to it.
    pub fn new() -> (
        Self,
        tokio::sync::mpsc::Receiver<NetworkCommand>,
        PluggableClient,
        tokio::sync::mpsc::Receiver<ExternalEvents>,
    ) {
        let (plugin_sender, plugin_receiver) = mpsc::channel(8);
        let (net_cmd_sendr, command_receiver) = tokio::sync::mpsc::channel(8);
        let (evt_emitter, plugin_evts) = tokio::sync::mpsc::channel(100);
        let (client_sender, client_receiver) = tokio::sync::oneshot::channel();

        (
            Self {
                plugins: Default::default(),
                plugin_receiver,
                client_handle: None,
                evt_emitter: evt_emitter.clone(),
                client_sender: Some(client_sender),
            },
            command_receiver,
            PluggableClient::new(plugin_sender, net_cmd_sendr, evt_emitter, client_receiver),
            plugin_evts,
        )
    }

    /// Runs the peerpiper service on the given plugin manager
    pub async fn run(
        &mut self,
        command_receiver: tokio::sync::mpsc::Receiver<NetworkCommand>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        tracing::debug!("Running");

        let (tx_client, rx_client) = oneshot::channel();
        let (tx_events, mut rx_events) = mpsc::channel(16);

        let libp2p_endpoints = vec![];

        tokio::spawn(async move {
            peerpiper::start(tx_events, command_receiver, tx_client, libp2p_endpoints)
                .await
                .unwrap();
        });

        // await on rx_client to get the client handle
        let client_handle = rx_client.await?;
        self.client_handle = Some(client_handle.clone());

        // send the client_handle to the Commander Client
        if let Some(sendr) = self.client_sender.take() {
            sendr.send(client_handle).unwrap();
        }

        let _address = loop {
            if let Events::Outer(PublicEvent::ListenAddr { address, .. }) =
                rx_events.next().await.unwrap()
            {
                let msg = format!("RXD Address: {:?}", address);
                tracing::info!("{}", msg);
                self.evt_emitter
                    .send(ExternalEvents::Address(address.clone()))
                    .await
                    .unwrap();
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
                    self.evt_emitter.send(
                        ExternalEvents::Message(msg)
                        ).await.unwrap();
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
                        self.evt_emitter
                            .send(ExternalEvents::Message(msg))
                            .await
                            .unwrap();
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
                self.evt_emitter
                    .send(ExternalEvents::Message(msg))
                    .await
                    .unwrap();
                // TODO: Figure out what we want to do with the other new addresses.
                //handle_new_address(&address).await;
            }
            _ => {}
        }
        Ok(())
    }
}

/// Gives the user the ability to control the Pluggable Instance,
/// by Loading plugins and sending commands to the Pluggable Piper.
#[derive(Clone)]
pub struct PluggableClient {
    /// Plugin Sender to send plugins to the Pluggable Piper
    plugin_sender: mpsc::Sender<Plugin<PluginsState>>,
    /// Events emitted by the plugins
    evt_emitter: tokio::sync::mpsc::Sender<ExternalEvents>,
    /// Unified Commander to send system and netowrk commands
    pub commander: Arc<Mutex<Option<Commander<NativeBlockstore>>>>,
}

impl PluggableClient {
    /// Creates a new Loader
    fn new(
        plugin_sender: mpsc::Sender<Plugin<PluginsState>>,
        net_cmd_sendr: tokio::sync::mpsc::Sender<NetworkCommand>,
        evt_emitter: tokio::sync::mpsc::Sender<ExternalEvents>,
        client_receiver: tokio::sync::oneshot::Receiver<Client>,
    ) -> Self {
        let commander = Arc::new(Mutex::new(None));

        let commander_clone = commander.clone();
        // wait on rx_client to get the client handle
        tokio::spawn(async move {
            // 1. First we need a NativeBlockstore from NativeBlockstoreBuilder
            let blockstore = NativeBlockstoreBuilder::default().open().await.unwrap();

            // 2. Now we can create the basic Commander without network client or sender
            {
                let commander = Commander::new(blockstore);

                // we can set the command_clone without network
                let mut lock = commander_clone.lock().await;
                *lock = Some(commander);

                tracing::info!("System-only Commander ready");
            }

            // Now we wait for the network client handle
            let client_handle = client_receiver.await.unwrap();
            tracing::info!("Client handle received: {:?}", client_handle);

            // 3. Now that we have a network conenction, we can update our Commander to
            // incude the network sender and client
            let mut lock = commander_clone.lock().await;
            let commander = lock.as_mut().unwrap();
            commander
                .with_network(net_cmd_sendr)
                .with_client(client_handle);

            tracing::info!("NETWORKED Commander ready");
        });

        Self {
            plugin_sender,
            evt_emitter,
            commander,
        }
    }

    /// Loads the plugin by sending it to the [PluggablePiper].
    ///
    /// Saves the plugin to the local directory under `data_local_dir` using the
    /// `dirs` crate. Appends the plugin name to the path.
    ///
    /// # Example
    ///
    /// `$HOME`/.local/share|/home/alice/.local/share/pluggable_peerpiper/{plugin_name}
    pub async fn load_plugin(
        &mut self,
        name: String,
        wasm_bytes: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        // use dirs crate to join the path
        let dir = dirs::data_local_dir()
            .ok_or(crate::error::Error::UnknownPath)
            .map(|dir| dir.join("pluggable_peerpiper"))?;

        let plugin = Plugin::new(
            Environment::<PluginsState>::new(dir)?,
            &name.clone(),
            wasm_bytes,
            PluginsState::new(name, self.commander.clone(), self.evt_emitter.clone()),
        )
        .await?;

        self.plugin_sender.send(plugin).await?;

        Ok(())
    }

    /// Use the Commander to order [PeerPiperCommand]s
    pub async fn order(&mut self, command: AllCommands) -> Result<(), crate::Error> {
        let mut lock = self.commander.lock().await;
        let commander = lock.as_mut().unwrap();
        commander.order(command).await?;
        Ok(())
    }
}
