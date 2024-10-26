use thiserror::Error;

#[derive(Error, Debug)]
pub enum NativeError {
    /// From core::Error
    #[error("Core error {0}")]
    Core(#[from] peerpiper_core::error::Error),

    #[error("Error: {0}")]
    CoreLibp2p(#[from] peerpiper_core::libp2p::error::Error),

    /// From<libp2p::multiaddr::Error>
    #[error("Multiaddr error")]
    Multiaddr(#[from] libp2p::multiaddr::Error),

    /// From<libp2p::libp2p_identity::ParseError>
    #[error("Identity error")]
    Identity(#[from] libp2p::identity::ParseError),
}
