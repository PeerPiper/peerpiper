mod error;
pub mod platform;

use std::sync::Arc;

pub use error::Error;
pub use peerpiper_core as core;
use peerpiper_core::Multiaddr;
pub use platform::*;

use futures::channel::{
    mpsc::{self},
    oneshot,
};

pub use peerpiper_core::{
    events::{AllCommands, Events, PublicEvent},
    libp2p::api::Libp2pEvent,
    Commander, Protocol, ReturnValues, Stream, StreamProtocol,
};
use tokio::sync::Mutex as AsyncMutex;

#[derive(Clone)]
pub struct PeerPiper {
    pub commander: Arc<AsyncMutex<Commander<platform::Blockstore>>>,
    events: Arc<AsyncMutex<Option<oneshot::Receiver<mpsc::Receiver<Events>>>>>,
}

impl PeerPiper {
    /// Crate a new PeerPiper instance with the given struct which impls both
    /// [peerpiper_core::Blockstore] and
    pub fn new(blockstore: platform::Blockstore, config: platform::StartConfig) -> Self {
        let commander = Arc::new(AsyncMutex::new(Commander::new(blockstore.clone())));

        // 16 is arbitrary, but should be enough for now
        let (tx_evts, rx_evts) = mpsc::channel(16);

        // client sync oneshot
        let (tx_client, rx_client) = oneshot::channel();

        let (tx_ready, rx_ready) = oneshot::channel();
        // command_sender will be used by other wasm_bindgen functions to send commands to the network
        // so we will need to wrap it in a Mutex or something to make it thread safe.
        let (network_command_sender, network_command_receiver) = tokio::sync::mpsc::channel(8);

        platform::spawn(async move {
            start(
                tx_evts,
                network_command_receiver,
                tx_client,
                blockstore,
                config,
            )
            .await
            .expect("never end")
        });

        let commander_clone = commander.clone();
        platform::spawn(async move {
            // wait on rx_client to get the client handle
            let client_handle = rx_client.await.expect("Client handle not available");

            commander_clone
                .lock()
                .await
                .with_network(network_command_sender)
                .with_client(client_handle);

            tx_ready.send(rx_evts).expect("Failed to send ready signal");
        });

        Self {
            commander,
            events: Arc::new(AsyncMutex::new(Some(rx_ready))),
        }
    }

    /// Takes the event Receiver to listen to network events.
    ///
    /// Returns an error if called more than once, as the events can only be taken once.
    pub async fn events(&self) -> Result<mpsc::Receiver<Events>, Error> {
        match self.events.lock().await.take() {
            Some(receiver) => receiver.await.map_err(|_| Error::EventsUnavailable),
            None => Err(Error::EventsUnavailable),
        }
    }
    /// Send Commands to PeerPiper whether connected or not.
    ///
    /// Throws an error if network command are sent before connecting to the network.
    ///
    /// put and get can store and retrieve data locally without network connection.
    pub async fn order(&self, command: AllCommands) -> Result<ReturnValues, Error> {
        {
            let commander = self.commander.lock().await;
            let client = commander.client.lock().await;
            if client.is_none() {
                return Err(Error::NotConnected);
            }
        }

        Ok(self.commander.lock().await.order(command).await?)
    }

    /// Try to connect to the list of endpoints.
    /// Send the `on_event` callback to the Commander to be called when an event is received.
    pub async fn connect(&mut self, addr: Multiaddr) -> Result<(), Error> {
        tracing::info!("Connected to the network, netowrk client available");

        self.commander
            .lock()
            .await
            .order(AllCommands::Dial(addr))
            .await
            .map_err(|e| {
                tracing::error!("Failed to connect to the network: {:?}", e);
                e
            })?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    //use super::*;
    use futures::StreamExt;
    use peerpiper::{BlockstoreBuilder, Error, Events, PeerPiper, PublicEvent, StartConfig};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_peerpiper() -> Result<(), Error> {
        let tempdir = tempdir().unwrap().path().to_path_buf();
        let blockstore = BlockstoreBuilder::new(tempdir).open().await.unwrap();

        let peerpiper = PeerPiper::new(blockstore, StartConfig::default());

        let events = peerpiper.events().await?;

        // We fuse the events stream so that it stops when the peerpiper is dropped.
        // Otherwise, the stream would continue to run forever.
        let mut events = events.fuse();

        // We expect the first event to be the ListenAddr event.
        // This event is emitted when the peerpiper is ready to accept connections.
        let event = events.next().await.unwrap();
        assert!(matches!(
            event,
            Events::Outer(PublicEvent::ListenAddr { .. })
        ));

        Ok(())
    }
}
