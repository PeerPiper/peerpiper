mod error;
//pub mod handler;

use error::Error;
use futures::channel::{mpsc, oneshot};
use libp2p::multiaddr::{Multiaddr, Protocol};
use std::net::Ipv6Addr;

use peerpiper_core::{
    error::Error as CoreError,
    events::{Events, PeerPiperCommand},
    libp2p::{
        api::{self, Client},
        behaviour, swarm,
    },
};

pub async fn start(
    tx: mpsc::Sender<Events>,
    command_receiver: mpsc::Receiver<PeerPiperCommand>,
    tx_client: oneshot::Sender<Client>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut swarm = swarm::create(behaviour::build).map_err(CoreError::CreateSwarm)?;

    swarm
        .behaviour_mut()
        .kad
        .set_mode(Some(libp2p::kad::Mode::Server));

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

    tx_client.send(network_client.clone()).map_err(|_e| {
        tracing::error!("Failed to send network client to client");
        Error::Core(CoreError::String(
            "Failed to send network client to client".to_string(),
        ))
    })?;

    network_client
        .run(network_events, command_receiver, tx)
        .await;

    Ok(())
}
