#![cfg(target_arch = "wasm32")]

use crate::error::Error;

use futures::StreamExt;
use libp2p::core::Multiaddr;
use libp2p::ping;
use libp2p::swarm::SwarmEvent;
use libp2p_webrtc_websys as webrtc_websys;
use std::time::Duration;
// use wasm_bindgen::prelude::*;

pub async fn spawn_swarm(libp2p_endpoint: String) -> Result<(), Error> {
    tracing::info!("Spawning swarm. Using multiaddr {:?}", libp2p_endpoint);

    let mut swarm = libp2p::SwarmBuilder::with_new_identity()
        .with_wasm_bindgen()
        .with_other_transport(|key| {
            webrtc_websys::Transport::new(webrtc_websys::Config::new(&key))
        })?
        .with_behaviour(|_| ping::Behaviour::new(ping::Config::new()))?
        // Ping does not KeepAlive, so we set the idle connection timeout to 32_212_254u64,
        // which is the largest value that works with the wasm32 target.
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(32_212_254u64)))
        .build();

    let addr = libp2p_endpoint.parse::<Multiaddr>()?;
    tracing::info!("Dialing {addr}");
    swarm.dial(addr)?;

    loop {
        futures::select! {
            event = swarm.next() => {
                match event.unwrap() {
                    SwarmEvent::Behaviour(ping::Event { result: Err(e), .. }) => {
                        tracing::error!("Ping failed: {:?}", e);

                        break;
                    }
                    SwarmEvent::Behaviour(ping::Event {
                        peer,
                        result: Ok(rtt),
                        ..
                    }) => {
                        tracing::info!("Ping successful: RTT: {rtt:?}, from {peer}");
                    }
                    evt => tracing::info!("Swarm event: {:?}", evt),
                }
            }
        }
    }

    Ok(())
}
