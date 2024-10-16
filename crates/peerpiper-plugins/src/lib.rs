//! The plugins module setups up the WIT component boilerplate code.

mod error;
pub mod sync;
pub mod tokio_compat;
mod utils;

pub use error::Error;
