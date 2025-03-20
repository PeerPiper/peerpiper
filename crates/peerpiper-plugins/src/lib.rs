//! The plugins module setups up the WIT component boilerplate code.
//!
//! Includes a Plugins Manager that provides a public facing API to load plugins
//! from your channel of choice.

/// Use this module if you're using tokio
// only on not wasm32
#[cfg(not(target_arch = "wasm32"))]
pub mod tokio;

/// Crate error module
mod error;

/// Use wasm_component_layer to manage plugins
pub mod layer;

// [Depracted] Use this module if you don't require async support
// pub mod sync;

mod utils;

pub use crate::error::Error;
