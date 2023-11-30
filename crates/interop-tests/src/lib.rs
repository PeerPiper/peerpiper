#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

pub async fn run_test() {}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn run_test_wasm() -> Result<(), JsError> {
    let result = run_test().await;
    tracing::info!(?result, "Sending test result");
}
