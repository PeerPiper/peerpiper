//! Platform specific code.

pub use peerpiper::platform::*;

#[cfg(not(target_arch = "wasm32"))]
pub use std::time::SystemTime;

#[cfg(target_arch = "wasm32")]
pub use web_time::SystemTime;

// if not android AND not wasm32, use wasmtime_runtime_layer
#[cfg(not(any(target_os = "android", target_arch = "wasm32")))]
pub use wasmi_runtime_layer as runtime_layer;

#[cfg(target_os = "android")]
pub use wasmi_runtime_layer as runtime_layer;

#[cfg(target_arch = "wasm32")]
pub use js_wasm_runtime_layer as runtime_layer;
