use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    /// From<Infallible>
    #[error("Infallible")]
    Infallible(#[from] std::convert::Infallible),
    /// From<libp2p::multiaddr::Error>
    #[error("Multiaddr error")]
    Multiaddr(#[from] libp2p::multiaddr::Error),
    /// From<DialError>
    #[error("Dial error")]
    Dial(#[from] libp2p::swarm::DialError),
}
