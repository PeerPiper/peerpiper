use futures::{channel::mpsc, SinkExt};
use libp2p::{
    core::muxing::StreamMuxerBox,
    core::Transport,
    futures::StreamExt,
    multiaddr::{Multiaddr, Protocol},
    ping::{self, Event},
    swarm::SwarmEvent,
};
use rand::thread_rng;
use std::net::Ipv4Addr;
use std::time::Duration;

pub async fn start(
    mut tx: mpsc::Sender<SwarmEvent<Event>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut swarm = libp2p::SwarmBuilder::with_new_identity()
        .with_tokio()
        .with_other_transport(|id_keys| {
            Ok(libp2p_webrtc::tokio::Transport::new(
                id_keys.clone(),
                libp2p_webrtc::tokio::Certificate::generate(&mut thread_rng())?,
            )
            .map(|(peer_id, conn), _| (peer_id, StreamMuxerBox::new(conn))))
        })?
        .with_behaviour(|_| ping::Behaviour::default())?
        .with_swarm_config(|cfg| {
            cfg.with_idle_connection_timeout(
                Duration::from_secs(30), // Allows us to observe the pings.
            )
        })
        .build();

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

#[cfg(test)]
mod tests {
    // use super::*;

    #[test]
    fn it_works() {}
}
