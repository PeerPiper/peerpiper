mod error;
pub mod platform;

pub use error::Error;
pub use peerpiper_core as core;
pub use platform::*;

use futures::{
    channel::{
        mpsc::{self},
        oneshot,
    },
    StreamExt,
};

pub use peerpiper_core::{
    events::{AllCommands, Events},
    libp2p::api::Libp2pEvent,
    Commander, Protocol, ReturnValues, Stream, StreamProtocol,
};
use tokio::sync::mpsc::Sender;

#[derive(Clone)]
pub struct PeerPiper {
    pub commander: Commander<platform::Blockstore>,
}

impl PeerPiper {
    /// Crate a new PeerPiper instance with the given struct which impls both
    /// [peerpiper_core::Blockstore] and
    pub fn new(blockstore: platform::Blockstore) -> PeerPiper {
        let commander = Commander::new(blockstore);
        Self { commander }
    }

    /// Send Commands to PeerPiper whether connected or not.
    ///
    /// Throws an error if network command are sent before connecting to the network.
    ///
    /// put and get can store and retrieve data locally without network connection.
    pub async fn order(&self, command: AllCommands) -> Result<ReturnValues, Error> {
        Ok(self.commander.order(command).await?)
    }

    /// Try to connect to the list of endpoints.
    /// Send the `on_event` callback to the Commander to be called when an event is received.
    pub async fn connect(
        &mut self,
        libp2p_endpoints: Vec<String>,
        protocols: Vec<StreamProtocol>,
    ) -> Result<impl FnOnce(Sender<Events>), Error> {
        // 16 is arbitrary, but should be enough for now
        let (tx_evts, mut rx_evts) = mpsc::channel(16);

        // client sync oneshot
        let (tx_client, rx_client) = oneshot::channel();

        // command_sender will be used by other wasm_bindgen functions to send commands to the network
        // so we will need to wrap it in a Mutex or something to make it thread safe.
        let (network_command_sender, network_command_receiver) = tokio::sync::mpsc::channel(8);

        let bstore = self.commander.blockstore.clone();

        platform::spawn(async move {
            start(
                tx_evts,
                network_command_receiver,
                tx_client,
                libp2p_endpoints,
                bstore,
                protocols,
            )
            .await
            .expect("never end")
        });

        // wait on rx_client to get the client handle
        let client_handle = rx_client.await?;

        self.commander
            .with_network(network_command_sender)
            .with_client(client_handle);

        let listen = |on_event: Sender<Events>| {
            platform::spawn(async move {
                while let Some(event) = rx_evts.next().await {
                    if let Err(e) = on_event.send(event).await {
                        tracing::error!("Failed to send event to on_event callback: {:?}", e);
                    }
                }
            });
        };

        Ok(listen)
    }
}
