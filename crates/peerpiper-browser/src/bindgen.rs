//! Wasm-bindgen bindings to the public API that is exported to JavaScript.
//! This API should be the same as the WIT interface that imports it when used with a WIT UI (such
//! as Wurbo).
//! That wat the WIT interface can simply import the same API and use it to communicate with the
use futures::SinkExt;
use futures::{channel::mpsc, StreamExt};
use gloo_utils::format::JsValueSerdeExt;
pub use peerpiper_core::events::PeerPiperCommand;
use std::sync::Mutex;
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::spawn_local;

const MAX_CHANNELS: usize = 16;

/// This wraps command_sender in a Mutex so we can call it from multiple wasm_bindgen functions
/// without worrying about thread safety.
/// Make the OnceLock inner value mutable so we can call get_mut() on it.
/// This makes our wasm API clean enough to interface directly to WIT world.
static COMMAND_SENDER: OnceLock<Mutex<mpsc::Sender<PeerPiperCommand>>> = OnceLock::new();

cfg_if::cfg_if! {
    if #[cfg(feature = "logging")] {
        fn init_log() {
            console_error_panic_hook::set_once();
            tracing_wasm::set_as_global_default();
        }
    } else {
        fn init_log() {}
    }
}

#[wasm_bindgen]
pub async fn connect(libp2p_endpoint: &str, callback: &js_sys::Function) -> Result<(), JsError> {
    init_log();

    let (tx, mut rx) = mpsc::channel(MAX_CHANNELS);

    // command_sender will be used by other wasm_bindgen functions to send commands to the network
    // so we will need to wrap it in a Mutex or something to make it thread safe.
    let (command_sender, command_receiver) = mpsc::channel(8);
    // move command_sender into COMMAND_SENDER
    COMMAND_SENDER.get_or_init(|| Mutex::new(command_sender));

    let endpoint = libp2p_endpoint.to_string().clone();

    spawn_local(async move {
        crate::start(tx, command_receiver, endpoint)
            .await
            .expect("never end")
    });

    let this = JsValue::null();

    while let Some(event) = rx.next().await {
        tracing::debug!("Rx BINDGEN Event: {:?}", event);
        let evt = JsValue::from_serde(&event).unwrap();
        let _ = callback.call1(&this, &evt);
    }

    tracing::info!("Done test");
    Ok(())
}

/// Uses COMMAND_SENDER (if initialized) to send a command to the network.
/// Else, returns an error.
pub async fn send_command(command: PeerPiperCommand) -> Result<(), JsError> {
    tracing::info!("Sending command: {:?}", command);
    let command_sender = COMMAND_SENDER.get().ok_or_else(|| {
        JsError::new(
            "Command sender not initialized. Did you call `connect()` first to establish a connection?",
        )
    })?;

    command_sender
        .lock()
        .map_err(|err| JsError::new(&format!("Failed to lock command sender: {}", err)))?
        .send(command)
        .await
        .map_err(|err| JsError::new(&format!("Failed to send command: {}", err)))?;
    Ok(())
}

/// Publish to this topic String these bytes
#[wasm_bindgen]
pub async fn publish(topic: String, data: Vec<u8>) -> Result<(), JsError> {
    send_command(PeerPiperCommand::Publish { topic, data }).await
}

/// Subscribe to this topic String
#[wasm_bindgen]
pub async fn subscribe(topic: String) -> Result<(), JsError> {
    send_command(PeerPiperCommand::Subscribe { topic }).await
}

/// Unsubscribe from this topic String
/// This will stop receiving messages from this topic.
#[wasm_bindgen]
pub async fn unsubscribe(topic: String) -> Result<(), JsError> {
    send_command(PeerPiperCommand::Unsubscribe { topic }).await
}

/// Takes any json string and tries to deserialize it into a PeerPiperCommand,
/// then sends it to the network.
/// If it fails, returns an error.
#[wasm_bindgen]
pub async fn command(json: &str) -> Result<(), JsError> {
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
    send_command(command).await
}
