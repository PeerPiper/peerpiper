#[cfg(target_arch = "wasm32")]
pub use peerpiper_browser::start;

#[cfg(not(target_arch = "wasm32"))]
pub use peerpiper_native::{start, NativeError as Error};

/// Re-export peerpiper_core as peerpiper::core
pub use peerpiper_core as core;
