#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// Error creating the Swarm
    #[error("Error creating the Swarm: {0}")]
    CreateSwarm(String),

    /// From<peerpiper_core::error::Error>
    #[error("Error from peerpiper_core: {0}")]
    PeerPiperCoreError(#[from] peerpiper_core::error::Error),

    /// From<futures::futures_channel::oneshot::Canceled>
    #[error("Oneshot channel was canceled")]
    OneshotCanceled(#[from] futures::channel::oneshot::Canceled),
}
