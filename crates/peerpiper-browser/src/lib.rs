#[cfg(target_arch = "wasm32")] // <== Required otherwise  workspace build break
pub mod bindgen;

#[cfg(target_arch = "wasm32")] // <== Required otherwise  workspace build break
pub mod blockstore;

mod error;

use crate::error::Error;
use peerpiper_core::events::{Events, PeerPiperCommand};
use peerpiper_core::libp2p::api::{self, Client};
use peerpiper_core::libp2p::{
    behaviour::{self},
    swarm,
};

use futures::channel::{mpsc, oneshot};
use libp2p::core::Multiaddr;
use wasm_bindgen_futures::spawn_local;

pub async fn start(
    tx: mpsc::Sender<Events>,
    command_receiver: mpsc::Receiver<PeerPiperCommand>,
    tx_client: oneshot::Sender<Client>,
    libp2p_endpoint: String,
) -> Result<(), Error> {
    tracing::info!("Spawning swarm. Using multiaddr {:?}", libp2p_endpoint);

    let swarm = swarm::create(behaviour::build).map_err(|err| {
        tracing::error!("Failed to create swarm: {}", err);
        Error::Core(peerpiper_core::error::Error::CreateSwarm(
            "Failed to create swarm".to_string(),
        ))
    })?;

    let _peer_id = *swarm.local_peer_id();

    let (mut network_client, network_events, network_event_loop) = api::new(swarm).await;

    spawn_local(network_event_loop.run());

    let mut remote_address = libp2p_endpoint.parse::<Multiaddr>()?;

    match network_client.dial(remote_address.clone()).await {
        Ok(_) => {
            println!("☎️ 🎉 Dialed remote peer at {}", remote_address);
        }
        Err(err) => {
            eprintln!("Failed to dial remote peer at {}: {}", remote_address, err);
        }
    }

    // add remote peer_id as explicit peer so we can gossipsub to it with minimal peers available
    if let Some(remote_peer_id) = remote_address.pop() {
        if let libp2p::core::multiaddr::Protocol::P2p(rpid) = remote_peer_id {
            tracing::info!("Adding remote peer_id as explicit peer: {:?}", rpid);
            network_client.add_peer(rpid).await;
            tracing::info!("ADDED remote peer_id as explicit peer: {:?}", rpid);
        }
    }

    tx_client.send(network_client.clone()).map_err(|_e| {
        tracing::error!("Failed to send network client to user");
        Error::Core(peerpiper_core::error::Error::String(
            "Failed to send network client to client".to_string(),
        ))
    })?;

    network_client
        .run(network_events, command_receiver, tx)
        .await;

    Ok(())
}
