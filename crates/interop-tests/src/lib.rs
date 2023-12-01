#![cfg(any(target_arch = "wasm32", rust_analyzer))]

use peerpiper_browser::wasm::spawn_swarm;
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn run_test_wasm(libp2p_endpoint: String) -> Result<(), JsError> {
    tracing_wasm::set_as_global_default();
    tracing::info!("Running wasm test");
    spawn_swarm(libp2p_endpoint).await?;
    // let result = run_test().await;
    tracing::info!("Done test");
    Ok(())
}
