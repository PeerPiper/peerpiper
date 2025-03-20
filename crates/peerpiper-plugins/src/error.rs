//! Error crate, uses thiserror.

#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// from Anyhow
    #[error("Anyhow Error: {0}")]
    Anyhow(#[from] anyhow::Error),

    /// std io
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),

    /// Tokio Error from crate::tokio::error::Error as TokioError;
    #[cfg(not(target_arch = "wasm32"))]
    #[error("Tokio Plugin Component Error: {0}")]
    Tokio(#[from] crate::tokio::error::Error),

    /// From JoinError
    #[cfg(not(target_arch = "wasm32"))]
    #[error("JoinError: {0}")]
    JoinError(#[from] tokio::task::JoinError),

    /// Unknown directory path
    #[error("Unknown Path")]
    UnknownPath,

    /// Peerpiper error
    #[error("PeerPiper Error: {0}")]
    PeerPiper(#[from] peerpiper::core::error::Error),

    /// From<futures::futures_channel::mpsc::SendError>
    #[error("SendError: {0}")]
    SendError(#[from] futures::channel::mpsc::SendError),
}
