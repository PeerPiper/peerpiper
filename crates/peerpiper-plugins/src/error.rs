//! Error crate, uses thiserror.

#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// from Anyhow
    #[error("Anyhow Error: {0}")]
    Anyhow(#[from] anyhow::Error),

    /// std io
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),

    /// tokio_two Error
    #[error("Plugin Component Error: {0}")]
    TokioTwo(#[from] crate::tokio::bindgen::component::extension::types::Error),

    /// sync modul errors
    #[error("Plugin Component Error: {0}")]
    Sync(#[from] crate::sync::bindgen::component::extension::types::Error),

    /// From JoinError
    #[error("JoinError: {0}")]
    JoinError(#[from] tokio::task::JoinError),
}
