use futures::{channel::mpsc, SinkExt};
use peerpiper_core::error::Error;
use peerpiper_core::events::NetworkEvent;
use peerpiper_core::libp2p::api;
use peerpiper_core::libp2p::{
    behaviour::{self},
    swarm,
};

use futures::StreamExt;
use libp2p::core::Multiaddr;
use wasm_bindgen_futures::spawn_local;

pub async fn start(
    mut tx: mpsc::Sender<NetworkEvent>,
    libp2p_endpoint: String,
) -> Result<(), Error> {
    tracing::info!("Spawning swarm. Using multiaddr {:?}", libp2p_endpoint);

    let swarm = swarm::create(behaviour::build).map_err(Error::CreateSwarm)?;

    let _peer_id = *swarm.local_peer_id();

    let (mut network_client, mut network_events, network_event_loop) = api::new(swarm).await;

    spawn_local(network_event_loop.run());

    let remote_address = libp2p_endpoint.parse::<Multiaddr>()?;

    match network_client.dial(remote_address.clone()).await {
        Ok(_) => {
            println!("☎️ 🎉 Dialed remote peer at {}", remote_address);
        }
        Err(err) => {
            eprintln!("Failed to dial remote peer at {}: {}", remote_address, err);
        }
    }

    loop {
        let event = network_events.select_next_some().await;
        tracing::debug!("Network event: {:?}", event);
        if let Err(network_event) = tx.send(event).await {
            tracing::error!("Failed to send swarm event: {:?}", network_event);
            // break;
            continue;
        }
    }
}
