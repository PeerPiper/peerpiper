use std::time::Duration;

use libp2p::{identity::Keypair, ping, swarm::NetworkBehaviour};

/// The [NetworkBehaviour] also creates a [BehaviourEvent] for us, which we can use to
/// handle events from the behaviour.
#[derive(NetworkBehaviour)]
pub struct Behaviour {
    ping: ping::Behaviour,
}

pub fn build(_key: &Keypair) -> Behaviour {
    Behaviour {
        ping: ping::Behaviour::new(ping::Config::new().with_interval(Duration::from_secs(5))),
        // Need to include identify until https://github.com/status-im/nim-libp2p/issues/924 is resolved.
        // identify: identify::Behaviour::new(identify::Config::new(
        //     "/interop-tests".to_owned(),
        //     key.public(),
        // )),
    }
}
