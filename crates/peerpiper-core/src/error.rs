#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// Error creating the Swarm
    #[error("Error creating the Swarm: {0}")]
    CreateSwarm(String),

    // /// From std::convert::Infallible
    // #[error("Infallible")]
    // Infallible(#[from] std::convert::Infallible),
    /// from string
    #[error("Error: {0}")]
    String(String),

    #[error("Multiaddr error")]
    Multiaddr(#[from] libp2p::multiaddr::Error),
    /// From<DialError>
    #[error("Dial error")]
    Dial(#[from] libp2p::swarm::DialError),
}
