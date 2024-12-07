#[derive(thiserror::Error, Debug)]
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

    /// Error putting data into Blockstore
    #[error("Error putting data into Blockstore")]
    BlockStoreError(#[from] peerpiper_core::wnfs_common::BlockStoreError),

    /// From<peerpiper_core::wnfs_common::libipld::cid::Error>
    #[error("Cid error {0}")]
    Cid(#[from] peerpiper_core::wnfs_common::libipld::cid::Error),

    /// No data directory
    #[error("No data directory")]
    NoDataDir,

    /// Input output error
    #[error("IO error")]
    Io(#[from] std::io::Error),

    /// from anyhow
    #[error("error")]
    Anyhow(#[from] anyhow::Error),
}
