use libp2p::Multiaddr;

#[derive(Debug)]
pub enum NetworkError {}

/// Peerpiper events from the network.
#[derive(Debug)]
pub enum Network {
    Libp2p,
}

#[derive(Debug)]
pub enum NetworkEvent {
    ListenAddr {
        address: Multiaddr,
        network: Network,
    },
    Error {
        error: NetworkError,
    },
}
