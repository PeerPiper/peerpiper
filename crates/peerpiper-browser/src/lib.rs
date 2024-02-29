#[cfg(target_arch = "wasm32")]
pub mod bindgen;

mod error;
mod wasm;

pub use wasm::start;
