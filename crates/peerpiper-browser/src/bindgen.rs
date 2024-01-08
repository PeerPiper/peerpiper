//! The public API that is exported to JavaScript.
//!This API should be the same as the WIT interface that imports it when used with a WIT UI (such
//! as Wurbo).
use futures::{channel::mpsc, StreamExt};
use gloo_utils::format::JsValueSerdeExt;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::spawn_local;

const MAX_CHANNELS: usize = 16;

#[wasm_bindgen]
pub async fn connect(libp2p_endpoint: &str, callback: &js_sys::Function) -> Result<(), JsError> {
    tracing_wasm::set_as_global_default();

    let (tx, mut rx) = mpsc::channel(MAX_CHANNELS);

    let endpoint = libp2p_endpoint.to_string().clone();

    spawn_local(async move { crate::start(tx, endpoint).await.expect("never end") });

    let this = JsValue::null();

    while let Some(event) = rx.next().await {
        tracing::debug!("Rx BINDGEN Event: {:?}", event);
        let evt = JsValue::from_serde(&event).unwrap();
        let _ = callback.call1(&this, &evt);
    }

    tracing::info!("Done test");
    Ok(())
}
