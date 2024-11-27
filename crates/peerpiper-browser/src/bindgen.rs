//! Wasm-bindgen bindings to the public API that is exported to JavaScript.
//! This API should be the same as the WIT interface that imports it when used with a WIT UI (such
//! as Wurbo).
//! That wat the WIT interface can simply import the same API and use it to communicate with the

use futures::{
    channel::{mpsc, oneshot},
    StreamExt,
};
use peerpiper_core::events::PeerPiperCommand;
use peerpiper_core::Commander;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;

use crate::blockstore::BrowserBlockStore;

const MAX_CHANNELS: usize = 16;

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
            tracing::info!("Initialized logging peerpiper-browser v0.1.4");
        }
    } else {
        fn init_log() {}
    }
}

/// Initializes the logger
#[wasm_bindgen(start)]
pub fn start() {
    init_log();
}

// Refactor all the above code to use the new PeerPiper pattern instead of start(). Move the
// function to the PeerPiper struct as methods.
#[wasm_bindgen]
pub struct PeerPiper {
    /// Make interior mutability possible for the Commander struct with [RefCell]
    /// This way we can keep the idiomatic Rust way of borrowing and mutating with &self
    commander: RefCell<Commander<BrowserBlockStore>>,
}

#[wasm_bindgen]
impl PeerPiper {
    /// Creates a new PeerPiper instance with a given name.
    #[wasm_bindgen(constructor)]
    pub async fn new(name: String) -> Result<PeerPiper, JsValue> {
        let blockstore = BrowserBlockStore::new(&name);
        blockstore
            .open()
            .await
            .map_err(|err| JsValue::from_str(&format!("Error opening blockstore: {:?}", err)))?;
        let commander = Commander::new(blockstore);
        Ok(Self {
            commander: RefCell::new(commander),
        })
    }

    /// Connect to the network with the given a list of libp2p endpoints.
    #[wasm_bindgen]
    pub async fn connect(
        &self,
        libp2p_endpoints: Vec<String>,
        on_event: &js_sys::Function,
    ) -> Result<(), JsValue> {
        let (tx_evts, mut rx_evts) = mpsc::channel(MAX_CHANNELS);

        // client sync oneshot
        let (tx_client, rx_client) = oneshot::channel();

        // command_sender will be used by other wasm_bindgen functions to send commands to the network
        // so we will need to wrap it in a Mutex or something to make it thread safe.
        let (command_sender, command_receiver) = mpsc::channel(8);

        spawn_local(async move {
            crate::start(tx_evts, command_receiver, tx_client, libp2p_endpoints)
                .await
                .expect("never end")
        });

        // wait on rx_client to get the client handle
        let client_handle = rx_client
            .await
            .map_err(|e| JsValue::from_str(&format!("Error getting client handle: {:?}", e)))?;

        self.commander
            .borrow_mut()
            .with_network(command_sender)
            .with_client(client_handle);

        let this = JsValue::null();

        while let Some(event) = rx_evts.next().await {
            match event {
                peerpiper_core::events::Events::Outer(event) => {
                    tracing::info!("[Browser] Received event: {:?}", &event);
                    let evt = serde_wasm_bindgen::to_value(&event).map_err(|e| {
                        JsValue::from_str(&format!("Failed to serialize event: {:?}", e))
                    })?;
                    let _ = on_event.call1(&this, &evt);
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Takes any json string from a Guest Component, and tries to deserialize it into a PeerPiperCommand,
    #[wasm_bindgen]
    pub async fn command(&self, cmd: JsValue) -> Result<JsValue, JsValue> {
        //let example_put = PeerPiperCommand::System(SystemCommand::Put {
        //    bytes: vec![1, 2, 3],
        //});
        //
        //let serializer = Serializer::json_compatible();
        //tracing::debug!(
        //    "Example Put Command: {:?}",
        //    &example_put
        //        .serialize(&serializer)
        //        .expect("Failed to serialize example put command")
        //);
        //
        tracing::info!(
            "Example GetProviders Command: {:?}",
            serde_wasm_bindgen::to_value(&PeerPiperCommand::GetProviders { key: vec![1, 2, 3] })
                .expect("Failed to serialize example request response command")
        );

        tracing::info!("[ppb v0.1.7] Received command");

        let command: PeerPiperCommand = serde_wasm_bindgen::from_value(cmd)?;

        let maybe_result = self
            .commander
            .borrow_mut()
            .order(command)
            .await
            .map_err(|e| JsValue::from_str(&format!("Error executing command: {:?}", e)))?;

        // convert the ReturnValues enum to a JsValue (Cid as String, Vec<u8> as Uint8Array, or null)
        let js_val = match maybe_result {
            peerpiper_core::ReturnValues::None => JsValue::null(),
            // convert Vec<u8> to serde_bytes byte buffer so it comes out Uint8Array in JS
            peerpiper_core::ReturnValues::Data(data) => serde_wasm_bindgen::to_value(&data)?,
            peerpiper_core::ReturnValues::ID(cid) => serde_wasm_bindgen::to_value(&cid)?,
            peerpiper_core::ReturnValues::Providers(providers) => {
                let js_providers = js_sys::Array::new();
                for provider in providers {
                    js_providers.push(&JsValue::from_str(&provider.to_string()));
                }
                js_providers.into()
            }
        };
        Ok(js_val)
    }
}
