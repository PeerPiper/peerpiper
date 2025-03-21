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

    /// From crate::libp2p::error::Error
    #[error("Libp2p error")]
    Libp2p(#[from] crate::libp2p::error::Error),

    #[error("Libp2p error")]
    GossipSubMessageAuthenticity,

    /// SendError
    #[error("Send error")]
    SendError(#[from] futures::channel::mpsc::SendError),

    /// From<tokio::sync::mpsc::error::SendError<libp2p::api::NetworkCommand>>
    #[error("Tokio mpsc Send error")]
    TokioSendError(#[from] tokio::sync::mpsc::error::SendError<crate::libp2p::api::NetworkCommand>),
}
