//! Tokio specific errors

#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// from Anyhow
    #[error("Anyhow Error: {0}")]
    Anyhow(#[from] anyhow::Error),

    /// tokio Error, From<tokio::tokio_compat::bindgen::component::extension::types::Error>
    #[error("Plugin Component Error: {0}")]
    TokioTwo(#[from] crate::tokio::plugin::bindgen::component::extension::types::Error),

    /// From JoinError
    #[error("JoinError: {0}")]
    JoinError(#[from] tokio::task::JoinError),
}
