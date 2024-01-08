#![cfg(target_arch = "wasm32")]
use futures::{channel::mpsc, StreamExt};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;

#[wasm_bindgen]
pub async fn run_test_wasm(libp2p_endpoint: String) -> Result<(), JsError> {
    tracing_wasm::set_as_global_default();
    tracing::info!("Running wasm test");

    let (tx, mut rx) = mpsc::channel(16);

    spawn_local(async move {
        peerpiper::start(tx, libp2p_endpoint)
            .await
            .expect("never end")
    });

    while let Some(event) = rx.next().await {
        tracing::debug!("Rx BINDGEN Event: {:?}", event);
    }

    tracing::info!("Done test");
    Ok(())
}
