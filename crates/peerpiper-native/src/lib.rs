use futures::{channel::mpsc, SinkExt};
use libp2p::{
    futures::StreamExt,
    multiaddr::{Multiaddr, Protocol},
};
use std::net::Ipv4Addr;

use peerpiper_core::{
    error::Error,
    events::NetworkEvent,
    libp2p::{api, behaviour, swarm},
};

pub async fn start(mut tx: mpsc::Sender<NetworkEvent>) -> Result<(), Box<dyn std::error::Error>> {
    let swarm = swarm::create(behaviour::build).map_err(Error::CreateSwarm)?;

    let peer_id = *swarm.local_peer_id();
    tracing::info!("Local peer id: {:?}", peer_id);

    let (mut network_client, mut network_events, network_event_loop) = api::new(swarm).await;

    // We need to start the network event loop first in order to listen for our address
    let network_handle = tokio::spawn(async move { network_event_loop.run().await });

    let address_webrtc = Multiaddr::from(Ipv4Addr::UNSPECIFIED)
        .with(Protocol::Udp(0))
        .with(Protocol::WebRTCDirect);

    for addr in [
        address_webrtc,
        // address_quic, address_tcp
    ] {
        tracing::info!("Listening on {:?}", addr.clone());
        network_client
            .start_listening(addr)
            .await
            .expect("Listening not to fail.");
    }

    // The first event we should receive is the address we're listening on
    let address = loop {
        if let NetworkEvent::ListenAddr { address, .. } = network_events.select_next_some().await {
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

    let addr = address.with(Protocol::P2p(peer_id));

    // // send the addr via message using tx
    // tx.send(NetworkEvent::ListenAddr {
    //     address: addr.clone(),
    //     network: Network::Libp2p,
    // })
    // .await?;

    tokio::spawn(async move {
        loop {
            let event = network_events.select_next_some().await;
            tracing::debug!("Network event: {:?}", event);
            if let Err(network_event) = tx.send(event).await {
                tracing::error!("Failed to send swarm event: {:?}", network_event);
                break;
            }
        }
    });

    network_handle.await?;

    Ok(())
}
