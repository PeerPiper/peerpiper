#![cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub async fn run_test_wasm(libp2p_endpoint: String) -> Result<(), JsError> {
    tracing_wasm::set_as_global_default();
    tracing::info!("Running wasm test");
    peerpiper::start_wasm(libp2p_endpoint).await?;
    // let result = run_test().await;
    tracing::info!("Done test");
    Ok(())
}
