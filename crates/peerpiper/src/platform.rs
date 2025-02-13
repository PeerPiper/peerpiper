//! platform specific code

//#[cfg(not(target_arch = "wasm32"))]
//mod native;
//
//#[cfg(target_arch = "wasm32")]
//mod browser;

use std::future::Future;

#[cfg(target_arch = "wasm32")]
pub use peerpiper_browser::opfs::OPFSWrapped as Blockstore;

#[cfg(not(target_arch = "wasm32"))]
pub use peerpiper_native::NativeBlockstore as Blockstore;

#[cfg(target_arch = "wasm32")]
pub use peerpiper_browser::{start, StartConfig};

#[cfg(not(target_arch = "wasm32"))]
pub use peerpiper_native::{start, StartConfig};

/// Spawn for tokio
#[cfg(not(target_arch = "wasm32"))]
pub fn spawn(f: impl Future<Output = ()> + Send + 'static) {
    tracing::trace!("Spawning tokio task");
    tokio::spawn(f);
}

/// Spawn for browser wasm32
#[cfg(target_arch = "wasm32")]
pub fn spawn(f: impl Future<Output = ()> + 'static) {
    tracing::debug!("Spawning wasm_bingen future");
    wasm_bindgen_futures::spawn_local(f);
}
