/// The public API that is exported to JavaScript.
/// This API should be the same as the WIT interface that imports it when used with a WIT UI (such
/// as Wurbo).
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub async fn connect(libp2p_endpoint: &str) -> Result<(), JsError> {
    tracing_wasm::set_as_global_default();
    tracing::info!("Running wasm test");
    crate::start(libp2p_endpoint.to_string()).await?;
    // let result = run_test().await;
    tracing::info!("Done test");
    Ok(())
}
