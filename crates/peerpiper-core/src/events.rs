use libp2p::Multiaddr;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum NetworkError {}

/// Peerpiper events from the network.
#[derive(Debug, Serialize, Deserialize)]
pub enum Network {
    Libp2p,
}

/// Events from the Peerpiper network.
/// They should be network, transport, and protocol agnostic. Could be libp2p, Nostr or HTTPS
/// publish, for example.
/// This is marked non-exhaustive because we may want to add new events in the future.
#[derive(Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum NetworkEvent {
    ListenAddr {
        address: Multiaddr,
        network: Network,
    },
    Error {
        error: NetworkError,
    },
    Pong {
        peer: String,
        rtt: u64,
    },
    Message {
        peer: String,
        topic: String,
        data: Vec<u8>,
    },
}

/// Command Events to the PeerPiper network.
/// They should be network, transport, and protocol agnostic. Could be libp2p, Nostr or HTTPS
/// publish, for example.
/// They should be able to be serialized and sent over the wire.
/// They should be able to be deserialized and executed by the PeerPiper network.
/// This is marked non-exhaustive because we may want to add new events in the future.
#[derive(Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum PeerPiperCommand {
    Ping { peer: String },
    Publish { topic: String, data: Vec<u8> },
    Subscribe { topic: String },
    Unsubscribe { topic: String },
}
