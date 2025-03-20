//! Use wasm_component_layer to manage pluginAsyncs
//!
//! This module essentially calls [PeerPiper] then wires up the on_event to
//! pass to the plugins to handle the response actions.
mod error;
mod instances;
mod platform;

pub use error::Error;
use futures::channel::mpsc::{self, Sender};
use futures::channel::oneshot;
use futures::{SinkExt, StreamExt as _};
use peerpiper::core::events::PublicEvent;
use peerpiper::core::libp2p::api::NetworkCommand;
use peerpiper::core::Client;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;

pub use instances::{get_params, list_data, params_to_command, LayerPlugin};

use peerpiper::platform::Blockstore;
use peerpiper::{AllCommands, Commander, Events, Libp2pEvent, PeerPiper};
use wasm_component_layer::{List, ListType, Value, ValueType};

#[derive(Clone, Default)]
pub struct State;

pub trait Inner {
    /// Trigger a save event on the host
    fn save(&self) {}

    /// Update the state with the given key and value
    fn update(&mut self, key: &[u8], value: &[u8]) {}
}

impl Inner for State {}

/// The PluggablePeerPiper is a PeerPiper that can load plugins.
/// This struct
pub struct PluggablePeerPiper {
    pub peerpiper: PeerPiper,
    /// The plugins loaded into the PluggablePeerPiper
    pub plugins: HashMap<String, Arc<AsyncMutex<LayerPlugin>>>,
    /// Receives plugins from the user for laoding
    plugin_receiver: mpsc::Receiver<PluginDetails>,
    /// Transmit PublicEvents to the user
    tx_events: Sender<PublicEvent>,
    /// Receive commands from the user
    command_receiver: mpsc::Receiver<AllCommands>,
}

impl PluggablePeerPiper {
    pub fn new(blockstore: Blockstore, tx_events: Sender<PublicEvent>) -> (Self, PluggableClient) {
        let (plugin_sender, plugin_receiver) = mpsc::channel(8);
        let (net_cmd_sendr, command_receiver) = mpsc::channel(8);

        let peerpiper = PeerPiper::new(blockstore, Default::default());

        (
            Self {
                peerpiper,
                plugins: Default::default(),
                plugin_receiver,
                tx_events,
                command_receiver,
            },
            PluggableClient::new(plugin_sender, net_cmd_sendr),
        )
    }

    /// Add a plugin to the PluggablePeerPiper
    pub fn load(&mut self, name: &str, bytes: &[u8]) {
        let plugin = LayerPlugin::new(bytes, State, self.peerpiper.clone());
        self.plugins
            .insert(name.to_string(), Arc::new(AsyncMutex::new(plugin)));
    }

    /// Listen for events and handle them with plugins
    pub async fn run(
        &mut self,
        connected: oneshot::Sender<()>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let rx_evts = self.peerpiper.events().await?;

        let mut rx_evts = rx_evts.fuse();

        // emit connected event. Network client is available.
        tracing::info!("Connected to the network");
        if let Err(e) = connected.send(()) {
            tracing::error!("Failed to send connected event: {:?}", e);
        }

        loop {
            tokio::select! {
                // Send events to the plugins
                Some(msg) = rx_evts.next() => {
                    if let Err(e) = self.handle_event(msg).await {
                        tracing::error!(%e, "Error handling event");
                    }
                }
                // also select to recieve plugins from the [Loader]
                Some(plugin) = self.plugin_receiver.next() => {
                    let msg = format!("Plugin loaded: {:?}", plugin.name);
                    tracing::debug!("{}", msg);
                    //self.plugins.insert(plugin.state().name.clone(), plugin);
                    self.load(&plugin.name, &plugin.bytes);
                    //self.evt_emitter.send(
                    //    ExternalEvents::Message(msg)
                    //    ).await.unwrap();
                }
                // Also receive AllCommands and pass along to the PeerPiper
                Some(cmd) = self.command_receiver.next() => {
                    self.peerpiper.commander
                        .lock().await
                        .order(cmd).await?;
                }
            }
        }
    }

    /// Uses the [Plugin]s to handle the given event
    async fn handle_event(&mut self, event: Events) -> Result<(), Box<dyn std::error::Error>> {
        match event {
            // Outter/Public events are not handled by plugins
            Events::Outer(public_event) => {
                tracing::debug!("Received event: {:?}", &public_event);
                self.tx_events.send(public_event).await?;
            }
            // Inner events are events that can be handled by plugins
            Events::Inner(Libp2pEvent::InboundRequest { request, channel }) => {
                tracing::info!("Plugin Runner InboundRequest: {:?}", request);

                tracing::info!("Number of plugins: {}", self.plugins.len());

                // set up a loop over the plugins, and call handle_request on each
                // then break loop and return the first Ok response,if Err keep looping
                // until all plugins have been called
                for (name, plugin) in &mut self.plugins {
                    tracing::debug!("Calling plugin: {}", name);
                    // we need to deref the PeerRequest and turn it into a [Value] which is
                    // equivalent to a Vec<u8>
                    let arguments = Value::List(
                        List::new(
                            ListType::new(ValueType::U8),
                            request
                                .to_vec()
                                .iter()
                                .map(|u| Value::U8(*u))
                                .collect::<Vec<_>>(),
                        )
                        .unwrap(),
                    );

                    match plugin.lock().await.call("handle-request", &[arguments]) {
                        Ok(Some(Value::Result(result))) => {
                            if let Ok(Some(Value::List(list))) = &*result {
                                tracing::debug!("Plugin {} output: {:?}", name, list.len());
                                // Need to turn the value back into a Vec<u8>
                                // otherwise, continue to the next plugin
                                let bytes = list
                                    .iter()
                                    // filter map, take just the U8 values
                                    .filter_map(|v| match v {
                                        Value::U8(u) => Some(u),
                                        _ => None,
                                    })
                                    .collect::<Vec<_>>();

                                let msg = format!("[{}] Plugin output: {:?}", name, bytes.len());
                                tracing::debug!("{}", msg);
                                let commander = self.peerpiper.commander.lock().await;
                                let mut client = commander.client.lock().await;
                                if let Some(client) = client.as_mut() {
                                    client.respond_bytes(bytes, channel).await?;
                                };

                                break;
                            }
                        }
                        Err(e) => {
                            tracing::debug!("Plugin {} did not respond, error: {}", name, e);
                        }
                        _ => {
                            tracing::debug!("Plugin {} did not respond", name);
                        }
                    }
                }
            }
            Events::Inner(Libp2pEvent::PutRecordRequest { source, record }) => {
                // todo!()
                // TODO: pass these DHT put record requetss to the plugin
                tracing::info!("Plugin Runner PutRecordRequest: {:?}", source);
                //
            }
            Events::Inner(Libp2pEvent::StreamAvailable {
                stream_protocol: _,
                incoming_stream: _,
            }) => {
                // stream is experiemntal
            }
            Events::Inner(libp2p_evt) => {
                // todo!()
            }
        }
        Ok(())
    }
}

/// Plugin Details are name and wasm bytes
pub struct PluginDetails {
    /// The name of the plugin
    pub name: String,
    /// The wasm bytes of the plugin
    pub bytes: Vec<u8>,
}

/// Gives the user the ability to control the Pluggable Instance,
/// by Loading plugins and sending commands to the Pluggable Piper.
#[derive(Clone)]
pub struct PluggableClient {
    /// Plugin Sender to send plugins to the Pluggable Piper
    plugin_sender: mpsc::Sender<PluginDetails>,
    /// Unified Commander to send system and netowrk commands
    command_sender: mpsc::Sender<AllCommands>,
}

impl PluggableClient {
    /// Creates a new Loader
    fn new(
        plugin_sender: mpsc::Sender<PluginDetails>,
        command_sender: mpsc::Sender<AllCommands>,
    ) -> Self {
        Self {
            plugin_sender,
            command_sender,
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
        plugin_details: PluginDetails,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.plugin_sender.send(plugin_details).await?;

        Ok(())
    }

    /// Use the Commander to order [PeerPiperCommand]s
    pub async fn order(&mut self, command: AllCommands) -> Result<(), crate::Error> {
        Ok(self.command_sender.send(command).await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_component_layer::Value;

    fn is_normal<T: Sized + Send + Sync + Unpin>() {}

    #[test]
    fn test_is_normal() {
        is_normal::<PluggablePeerPiper>();
    }
}
