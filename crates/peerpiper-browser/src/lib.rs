//! PeerPiper Browser. Works from both JavaScript (bindgen feature) and eframe, Leptos style systems.

/// bindgen behind bindgen feature flag
#[cfg(feature = "bindgen")]
#[cfg(target_arch = "wasm32")]
pub mod bindgen;

#[cfg(target_arch = "wasm32")]
#[cfg(feature = "bindgen")]
pub mod blockstore;

/// Orinin Private File System
#[cfg(target_arch = "wasm32")]
pub mod opfs;

mod error;

pub use crate::error::Error;
use libp2p::StreamProtocol;
use peerpiper_core::events::Events;
use peerpiper_core::libp2p::api::{self, Client, NetworkCommand};
use peerpiper_core::libp2p::behaviour::BehaviourBuilder;
use peerpiper_core::libp2p::swarm;
pub use peerpiper_core::Blockstore;

use futures::channel::{mpsc, oneshot};
use libp2p::core::multiaddr::Protocol;
use libp2p::core::Multiaddr;
use wasm_bindgen_futures::spawn_local;

/// Config for starting PeerPiper.
/// - libp2p_endpoints: List of libp2p endpoints to connect to.
/// - protocols: List of [StreamProtocol] to use with libp2p-stream
/// - base_path: Path to the base directory for the blockstore and other data.
pub struct StartConfig {
    // TODO: This native node can dial other native nodes, like BOOTNODES
    pub libp2p_endpoints: Vec<String>,
    pub protocols: Vec<StreamProtocol>,
    pub base_path: Option<std::path::PathBuf>,
}

/// Call start in order to start the network and the event loop.
pub async fn start<B: Blockstore + 'static>(
    tx: mpsc::Sender<Events>,
    network_cmd_rx: tokio::sync::mpsc::Receiver<NetworkCommand>,
    tx_client: oneshot::Sender<Client>,
    blockstore: B,
    config: StartConfig,
) -> Result<(), Error> {
    let StartConfig {
        libp2p_endpoints,
        protocols: _,
        base_path,
    } = config;

    tracing::info!("Spawning swarm. Using multiaddr {:?}", libp2p_endpoints);

    let behaviour_builder = BehaviourBuilder::new(blockstore);

    let swarm = swarm::create(
        |key, relay_behaviour| behaviour_builder.build(key, relay_behaviour),
        base_path,
    )
    .await
    .map_err(|err| {
        tracing::error!("Failed to create swarm: {}", err);
        Error::Core(peerpiper_core::error::Error::CreateSwarm(
            "Failed to create swarm".to_string(),
        ))
    })?;

    let _peer_id = *swarm.local_peer_id();

    let (mut network_client, network_events, network_event_loop) = api::new(swarm).await;

    spawn_local(async move {
        let _ = network_event_loop.run().await;
    });

    for endpoint in libp2p_endpoints.iter() {
        let mut remote_address = endpoint.parse::<Multiaddr>()?;

        match network_client.dial(remote_address.clone()).await {
            Ok(_) => {
                tracing::info!("☎️ 🎉 Dialed remote peer at {}", remote_address);
            }
            Err(err) => {
                tracing::warn!("Failed to dial remote peer at {}: {}", remote_address, err);
            }
        }

        // add remote peer_id as explicit peer so we can gossipsub to it with minimal peers available
        if let Some(Protocol::P2p(rpid)) = remote_address.pop() {
            network_client.add_peer(rpid).await?;
            tracing::info!("Added remote peer_id as explicit peer: {:?}", rpid);
        }
    }

    // This will automatically accept all incoming streams.
    // The trouble with this is, it seems like native nodes automatically
    // open streams for new connections, but we don't have a handle to this stream???
    //
    //for p in protocols {
    //    if let Err(e) = network_client.accept_stream(p).await {
    //        tracing::error!("Failed to accept stream: {:?}", e);
    //    }
    //}

    tracing::info!("Sending network client to user");

    tx_client.send(network_client.clone()).map_err(|_e| {
        tracing::error!("Failed to send network client to user");
        Error::Core(peerpiper_core::error::Error::String(
            "Failed to send network client to client".to_string(),
        ))
    })?;

    tracing::info!("Running network client loop:");

    network_client.run(network_events, network_cmd_rx, tx).await;

    Ok(())
}
