use std::time::Duration;

use libp2p::{gossipsub, identify, identity::Keypair, kad, ping, swarm::NetworkBehaviour};
use libp2p_stream as stream;

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// The [NetworkBehaviour] also creates a [BehaviourEvent] for us, which we can use to
/// handle events from the behaviour.
#[derive(NetworkBehaviour)]
pub struct Behaviour {
    /// Ping remote peers
    pub(crate) ping: ping::Behaviour,
    /// Publish subscribe to topics
    pub(crate) gossipsub: gossipsub::Behaviour,
    /// Identify ourselves to other peers
    pub(crate) identify: identify::Behaviour,
    /// Kademlia DHT for Peer management
    pub(crate) kad: kad::Behaviour<kad::store::MemoryStore>,
    /// Stream responses
    pub(crate) stream: stream::Behaviour,
}

pub fn build(key: &Keypair) -> Behaviour {
    // To content-address message, we can take the hash of message and use it as an ID.
    let message_id_fn = |message: &gossipsub::Message| {
        let mut s = DefaultHasher::new();
        message.data.hash(&mut s);
        gossipsub::MessageId::from(s.finish().to_string())
    };

    // Set a custom gossipsub configuration
    let gossipsub_config = gossipsub::ConfigBuilder::default()
        // .heartbeat_interval(Duration::from_secs(10)) // This is set to aid debugging by not cluttering the log space
        .validation_mode(gossipsub::ValidationMode::Strict) // This sets the kind of message validation. The default is Strict (enforce message signing)
        .message_id_fn(message_id_fn) // content-address messages. No two messages of the same content will be propagated.
        .support_floodsub()
        .flood_publish(true)
        .build()
        .unwrap_or_default();

    // build a gossipsub network behaviour
    let gossipsub = gossipsub::Behaviour::new(
        gossipsub::MessageAuthenticity::Signed(key.clone()),
        gossipsub_config,
    )
    .expect("Config should be valid");

    let kad = kad::Behaviour::new(
        key.public().to_peer_id(),
        kad::store::MemoryStore::new(key.public().to_peer_id()),
    );

    Behaviour {
        ping: ping::Behaviour::new(ping::Config::new().with_interval(Duration::from_secs(25))),
        // Need to include identify until https://github.com/status-im/nim-libp2p/issues/924 is resolved.
        identify: identify::Behaviour::new(identify::Config::new(
            "/interop-tests".to_owned(),
            key.public(),
        )),
        gossipsub,
        kad,
        stream: stream::Behaviour::new(),
    }
}
