mod blockstore;
mod error;

pub use blockstore::{NativeBlockstore, NativeBlockstoreBuilder};

pub use error::NativeError;
use futures::channel::{mpsc, oneshot};
use libp2p::multiaddr::{Multiaddr, Protocol};
use std::net::{Ipv4Addr, Ipv6Addr};

use peerpiper_core::{
    error::Error as CoreError,
    events::Events,
    libp2p::{
        api::{self, Client},
        behaviour, swarm,
    },
};

// const BOOTNODES: [&str; 4] = [
//     "QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
//     "QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
//     "QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
//     "QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
// ];

pub async fn start(
    tx: mpsc::Sender<Events>,
    command_receiver: mpsc::Receiver<api::NetworkCommand>,
    tx_client: oneshot::Sender<Client>,
    // TODO: This native node can dial other native nodes, like BOOTNODES
    _libp2p_endpoints: Vec<String>,
) -> Result<(), NativeError> {
    let mut swarm = swarm::create(behaviour::build)
        .await
        .map_err(CoreError::CreateSwarm)?;

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

    let addr_webrtc_ipv4 = Multiaddr::from(Ipv4Addr::UNSPECIFIED)
        .with(Protocol::Udp(0))
        .with(Protocol::WebRTCDirect);

    for addr in [
        address_webrtc,
        addr_webrtc_ipv4,
        // address_quic, address_tcp
    ] {
        tracing::info!("Listening on {:?}", addr.clone());
        network_client.start_listening(addr).await?;
    }

    // for peer in &BOOTNODES {
    //     let addr = Multiaddr::from_str("/dnsaddr/bootstrap.libp2p.io")?
    //         .with(Protocol::P2p(libp2p::PeerId::from_str(peer)?));
    //     network_client.dial(addr).await?;
    // }

    tx_client.send(network_client.clone()).map_err(|_e| {
        tracing::error!("Failed to send network client to client");
        NativeError::Core(CoreError::String(
            "Failed to send network client to client".to_string(),
        ))
    })?;

    network_client
        .run(network_events, command_receiver, tx)
        .await;

    Ok(())
}
