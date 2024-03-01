//! Wasm-bindgen bindings to the public API that is exported to JavaScript.
//! This API should be the same as the WIT interface that imports it when used with a WIT UI (such
//! as Wurbo).
//! That wat the WIT interface can simply import the same API and use it to communicate with the

pub mod blockstore_idb;

use futures::SinkExt;
use futures::{channel::mpsc, StreamExt};
use gloo_utils::format::JsValueSerdeExt;
pub use peerpiper_core::events::PeerPiperCommand;
use std::sync::Mutex;
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;
use wnfs::common::CODEC_RAW;
use wnfs::common::{BlockStore, Storable};
use wnfs_unixfs_file::{
    builder::{Config, FileBuilder},
    chunker::{Chunker, ChunkerConfig},
};

const MAX_CHANNELS: usize = 16;

/// This wraps command_sender in a Mutex so we can call it from multiple wasm_bindgen functions
/// without worrying about thread safety.
/// Make the OnceLock inner value mutable so we can call get_mut() on it.
/// This makes our wasm API clean enough to interface directly to WIT world.
static COMMAND_SENDER: OnceLock<Mutex<mpsc::Sender<PeerPiperCommand>>> = OnceLock::new();
/// BrowserBlockStore
static BSTORE: OnceLock<Mutex<blockstore_idb::BrowserBlockStore>> = OnceLock::new();

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

    // Set up a blockstore in the browser
    let blockstore = blockstore_idb::BrowserBlockStore::new("peerpiper");
    blockstore.open().await?;

    BSTORE.get_or_init(|| Mutex::new(blockstore));

    Ok(())
}

#[wasm_bindgen]
pub async fn connect(libp2p_endpoint: &str, on_event: &js_sys::Function) -> Result<(), JsError> {
    let (tx_evts, mut rx_evts) = mpsc::channel(MAX_CHANNELS);

    // command_sender will be used by other wasm_bindgen functions to send commands to the network
    // so we will need to wrap it in a Mutex or something to make it thread safe.
    let (command_sender, command_receiver) = mpsc::channel(8);
    // move command_sender into COMMAND_SENDER
    COMMAND_SENDER.get_or_init(|| Mutex::new(command_sender));

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

/// Uses COMMAND_SENDER (if initialized) to send a command to the network.
/// Else, returns an error.
pub async fn send_command(command: PeerPiperCommand) -> Result<(), JsError> {
    tracing::trace!("Sending command");
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

/// Allows the user to save a file to the system (IndexedDB. TODO: Memory too?)
#[wasm_bindgen]
pub async fn save(data: Vec<u8>) -> Result<(), JsError> {
    tracing::info!("Saving to blockstore bytes {:?}", data.len());

    let blockstore = BSTORE
        .get()
        .ok_or_else(|| {
            JsError::new(
            "Blockstore not initialized. Did you call `start()` first to establish a connection?",
        )
        })?
        .lock()
        .unwrap();

    // The chunker needs to be here because it is specific to IndexedDB having a max size of 256 *
    // 1024 bytes. In another system (like a desktop disk) it could be chunked differently.
    let root_cid = FileBuilder::new()
        .content_bytes(data.clone())
        .fixed_chunker(256 * 1024)
        .build()
        .map_err(|err| JsError::new(&format!("Failed to build file: {}", err)))?
        .store(&blockstore.clone())
        .await
        .map_err(|err| JsError::new(&format!("Failed to store file: {}", err)))?;

    tracing::info!("Saved file to blockstore with CID: {:?}", root_cid);

    Ok(())
}
