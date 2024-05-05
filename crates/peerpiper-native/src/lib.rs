use futures::channel::mpsc;
use libp2p::multiaddr::{Multiaddr, Protocol};
use std::net::Ipv6Addr;

use peerpiper_core::{
    error::Error,
    events::{NetworkEvent, PeerPiperCommand},
    libp2p::{api, behaviour, swarm},
};

pub async fn start(
    tx: mpsc::Sender<NetworkEvent>,
    command_receiver: mpsc::Receiver<PeerPiperCommand>,
) -> Result<(), Box<dyn std::error::Error>> {
    let swarm = swarm::create(behaviour::build).map_err(Error::CreateSwarm)?;

    let peer_id = *swarm.local_peer_id();
    tracing::info!("Local peer id: {:?}", peer_id);

    let (mut network_client, network_events, network_event_loop) = api::new(swarm).await;

    // We need to start the network event loop first in order to listen for our address
    tokio::spawn(async move { network_event_loop.run().await });

    let address_webrtc = Multiaddr::from(Ipv6Addr::UNSPECIFIED)
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

    network_client
        .run(network_events, command_receiver, tx)
        .await;

    Ok(())
}
