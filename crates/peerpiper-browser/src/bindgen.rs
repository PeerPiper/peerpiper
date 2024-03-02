//! Wasm-bindgen bindings to the public API that is exported to JavaScript.
//! This API should be the same as the WIT interface that imports it when used with a WIT UI (such
//! as Wurbo).
//! That wat the WIT interface can simply import the same API and use it to communicate with the

use futures::{channel::mpsc, StreamExt};
use gloo_utils::format::JsValueSerdeExt;
pub use peerpiper_core::events::{PeerPiperCommand, SystemCommand};
use peerpiper_core::Commander;
use std::sync::Mutex;
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;

use crate::blockstore::BrowserBlockStore;

const MAX_CHANNELS: usize = 16;

static COMMANDER: OnceLock<Mutex<Commander<BrowserBlockStore>>> = OnceLock::new();

cfg_if::cfg_if! {
    if #[cfg(feature = "logging")] {
        fn init_log() {
            // use tracing_wasm::{WASMLayer, WASMLayerConfigBuilder};
            // use tracing_subscriber::layer::SubscriberExt;
            // use tracing_subscriber::Registry;
            //
            // let layer_config = WASMLayerConfigBuilder::new()
            //     .set_max_level(tracing::Level::WARN)
            //     .build();
            //
            // if let Err(_) = tracing::subscriber::set_global_default(Registry::default().with(WASMLayer::new(layer_config))) {
            //     tracing_wasm::set_as_global_default();
            // }
            //
            // tracing_wasm::set_as_global_default_with_config(layer_config);
            console_error_panic_hook::set_once();
            tracing_wasm::set_as_global_default();
        }
    } else {
        fn init_log() {}
    }
}

/// On start, always open up a new BrowserBlockstore named peerpiper.
/// As a local-frst app, we always need the storage even if not yet connected.
#[wasm_bindgen(start)]
pub async fn start() -> Result<(), JsValue> {
    init_log();

    let blockstore = BrowserBlockStore::new("peerpiper");
    blockstore
        .open()
        .await
        .map_err(|err| JsValue::from_str(&format!("Error opening blockstore: {:?}", err)))?;
    let commander = Commander::new(blockstore);
    COMMANDER.get_or_init(|| Mutex::new(commander));

    Ok(())
}

#[wasm_bindgen]
pub async fn connect(libp2p_endpoint: &str, on_event: &js_sys::Function) -> Result<(), JsError> {
    let (tx_evts, mut rx_evts) = mpsc::channel(MAX_CHANNELS);

    // command_sender will be used by other wasm_bindgen functions to send commands to the network
    // so we will need to wrap it in a Mutex or something to make it thread safe.
    let (command_sender, command_receiver) = mpsc::channel(8);
    // move command_sender into COMMANDER
    COMMANDER
        .get()
        .ok_or_else(|| JsError::new("Commander not initialized. Did `start()` complete?"))?
        .lock()
        .map_err(|err| JsError::new(&format!("Failed to lock commander: {}", err)))?
        .with_network(command_sender);

    let endpoint = libp2p_endpoint.to_string().clone();

    spawn_local(async move {
        crate::start(tx_evts, command_receiver, endpoint)
            .await
            .expect("never end")
    });

    let this = JsValue::null();

    while let Some(event) = rx_evts.next().await {
        // tracing::trace!("Rx BINDGEN Event: {:?}", event);
        let evt = JsValue::from_serde(&event).unwrap();
        let _ = on_event.call1(&this, &evt);
    }

    tracing::info!("Done test");
    Ok(())
}

/// Takes any json string from a Guest Component, and tries to deserialize it into a PeerPiperCommand,
/// then sends it to the COMMANDER who routes it to either the network or the system depending on the command.
/// If it fails, returns an error.
#[wasm_bindgen]
pub async fn command(json: &str) -> Result<JsValue, JsError> {
    let example_publish = PeerPiperCommand::Publish {
        topic: "example".to_string(),
        data: vec![1, 2, 3],
    };
    let command: PeerPiperCommand = serde_json::from_str(json).map_err(|err| {
        JsError::new(&format!(
            "Failed to parse command from JSON: {}. Expected format: {:?}",
            err.to_string(),
            serde_json::to_string(&example_publish).unwrap()
        ))
    })?;

    let maybe_result = COMMANDER
        .get()
        .ok_or_else(|| JsError::new("Commander not initialized. Did `start()` complete?"))?
        .lock()
        .map_err(|err| JsError::new(&format!("Failed to lock commander: {}", err)))?
        .order(command)
        .await
        .map_err(|err| JsError::new(&format!("Failed to send command: {}", err)))?;

    // convert the ReturnValues enum to a JsValue (Cid as String, Vec<u8> as Uint8Array, or null)
    let js_val = match maybe_result {
        peerpiper_core::ReturnValues::Data(data) => JsValue::from_serde(&data)?,
        peerpiper_core::ReturnValues::ID(cid) => JsValue::from_str(&cid.to_string()),
        peerpiper_core::ReturnValues::None => JsValue::null(),
    };
    Ok(js_val)
}
