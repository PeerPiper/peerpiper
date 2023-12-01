#[cfg(target_arch = "wasm32")]
pub use peerpiper_browser::start as start_wasm;

#[cfg(not(target_arch = "wasm32"))]
pub use peerpiper_native::start as start_native;
