use libp2p::Multiaddr;

#[derive(Debug)]
pub enum NetworkError {}

/// Peerpiper events from the network.
#[derive(Debug)]
pub enum Network {
    Libp2p,
}

/// Peerpiper events from the network.
/// They should be netowrk agnostic?
#[derive(Debug)]
pub enum NetworkEvent {
    ListenAddr {
        address: Multiaddr,
        network: Network,
    },
    Error {
        error: NetworkError,
    },
    Ping {
        peer: String,
        rtt: u64,
    },
}
