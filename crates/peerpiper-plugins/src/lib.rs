//! The plugins module setups up the WIT component boilerplate code.
//!
//! Includes a Plugins Manager that provides a public facing API to load plugins
//! from your channel of choice.

/// Use this module if you're using tokio
pub mod tokio;

/// Crate error module
mod error;

// [Depracted] Use this module if you don't require async support
// pub mod sync;

mod utils;

pub use crate::error::Error;
