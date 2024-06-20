#[cfg(target_arch = "wasm32")]
pub use peerpiper_browser::start;

#[cfg(not(target_arch = "wasm32"))]
pub use peerpiper_native::start;

/// Re-export the PeerPiper handler utlitiy for using API Handlers natively.
#[cfg(not(target_arch = "wasm32"))]
pub use peerpiper_native::handler;

/// Re-export peerpiper_core as peerpiper::core
pub use peerpiper_core as core;
