use futures::{channel::mpsc, SinkExt};
use libp2p::{
    futures::StreamExt,
    multiaddr::{Multiaddr, Protocol},
    swarm::SwarmEvent,
};
use std::net::Ipv4Addr;

use peerpiper_core::error::Error;
use peerpiper_core::libp2p::{
    behaviour::{self, BehaviourEvent},
    swarm,
};

pub async fn start(
    mut tx: mpsc::Sender<SwarmEvent<BehaviourEvent>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut swarm = swarm::create(behaviour::build).map_err(Error::CreateSwarm)?;

    let address_webrtc = Multiaddr::from(Ipv4Addr::UNSPECIFIED)
        .with(Protocol::Udp(0))
        .with(Protocol::WebRTCDirect);

    let listener_id = swarm.listen_on(address_webrtc.clone())?;

    tracing::info!("Listening on {:?}", address_webrtc);

    let address = loop {
        if let SwarmEvent::NewListenAddr { address, .. } = swarm.select_next_some().await {
            if address
                .iter()
                .any(|e| e == Protocol::Ip4(Ipv4Addr::LOCALHOST))
            {
                tracing::debug!("Ignoring localhost address to make sure it works in Firefox");
                continue;
            }

            tracing::info!(%address, "Listening");

            break address;
        }
    };

    let addr = address.with(Protocol::P2p(*swarm.local_peer_id()));

    // send the addr via message using tx
    tx.send(SwarmEvent::NewListenAddr {
        address: addr.clone(),
        listener_id,
    })
    .await?;

    tracing::info!("Local peer id: {:?}", swarm.local_peer_id());
    println!("External address: {}", addr);

    // Communicate any network events
    tokio::spawn(async move {
        loop {
            let swarm_event = swarm.select_next_some().await;
            if let Err(swarm_event) = tx.send(swarm_event).await {
                tracing::error!("Failed to send swarm event: {:?}", swarm_event);
                break;
            }
        }
    });

    Ok(())
}
