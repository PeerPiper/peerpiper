// #![cfg(target_arch = "wasm32")]

use peerpiper_core::error::Error;
use peerpiper_core::libp2p::{
    behaviour::{self, BehaviourEvent},
    swarm,
};

use futures::StreamExt;
use libp2p::core::Multiaddr;
use libp2p::ping;
use libp2p::swarm::SwarmEvent;

pub async fn start(libp2p_endpoint: String) -> Result<(), Error> {
    tracing::info!("Spawning swarm. Using multiaddr {:?}", libp2p_endpoint);

    let mut swarm = swarm::create(behaviour::build).map_err(Error::CreateSwarm)?;

    let addr = libp2p_endpoint.parse::<Multiaddr>()?;
    tracing::info!("Dialing {addr}");
    swarm.dial(addr)?;

    loop {
        futures::select! {
            event = swarm.next() => {
                match event.unwrap() {
                    SwarmEvent::Behaviour(BehaviourEvent::Ping(ping::Event { result: Err(e), .. })) => {
                        tracing::error!("Ping failed: {:?}", e);

                        break;
                    }
                    SwarmEvent::Behaviour(BehaviourEvent::Ping(ping::Event {
                        peer,
                        result: Ok(rtt),
                        ..
                    })) => {
                        tracing::info!("Ping successful: RTT: {rtt:?}, from {peer}");
                    }
                    evt => tracing::info!("Swarm event: {:?}", evt),
                }
            }
        }
    }

    Ok(())
}
