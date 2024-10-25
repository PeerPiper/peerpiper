use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    /// From core::Error
    #[error("Core error {0}")]
    Core(#[from] peerpiper_core::error::Error),
}
