//! Dynamic Protocol Handler

mod bindgen {
    // name of world
    wasmtime::component::bindgen!({
        path: "../peerpiper-handler/wit/world.wit",
        world: "handlers",
        async: true
    });
}

use crate::Error;
use peerpiper_core::events::PublicEvent;
use wasmtime::{component::*, Config, Engine, Store};
use wasmtime_wasi::{ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

use bindgen::exports::peerpiper::handler::handler::Event;
use bindgen::peerpiper::handler::types::{Message, Request};
use bindgen::Handlers;

struct StateWasiView {
    table: ResourceTable,
    ctx: WasiCtx,
}

impl StateWasiView {
    fn new() -> Self {
        let table = ResourceTable::new();
        let ctx = WasiCtxBuilder::new().inherit_stdout().args(&[""]).build();
        Self { table, ctx }
    }
}
impl WasiView for StateWasiView {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }

    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.ctx
    }
}

/// This is so that a component is only parsed and compiled once.
#[derive(Clone)]
pub struct Handler {
    engine: Engine,
    component: Component,
}

impl Handler {
    pub fn new(bytes: impl AsRef<[u8]>) -> Result<Self, Error> {
        // Enable component model support in Wasmtime
        let mut config = Config::default();
        config.wasm_component_model(true);
        config.async_support(true);

        // Load the component from the given path
        let engine = Engine::new(&config)?;
        let component = Component::new(&engine, bytes)?;
        Ok(Self { engine, component })
    }

    /// Handles the reuqest with the given context
    pub async fn handle(&self, evt: PublicEvent) -> Result<String, Error> {
        let mut linker = Linker::new(&self.engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;
        // Handlers::add_to_linker(&mut linker, |view| view)?;

        // Create a store for the component
        let wasi_view = StateWasiView::new();
        let mut store = Store::new(&self.engine, wasi_view);

        let (handler, _) =
            Handlers::instantiate_async(&mut store, &self.component, &linker).await?;

        let r = handler
            .peerpiper_handler_handler()
            .call_handle(store, &evt.into())
            .await?;
        Ok(r)
    }
}

/// Convert the PublicEvent to Event
impl From<PublicEvent> for Event {
    fn from(evt: PublicEvent) -> Self {
        match evt {
            PublicEvent::Message { topic, peer, data } => {
                Event::Message(Message { topic, data, peer })
            }
            _ => unimplemented!(),
        }
    }
}

pub mod utils {
    use std::{
        io,
        path::{Path, PathBuf},
    };

    /// Utility function to get the workspace dir
    fn workspace_dir() -> PathBuf {
        let output = std::process::Command::new(env!("CARGO"))
            .arg("locate-project")
            .arg("--workspace")
            .arg("--message-format=plain")
            .output()
            .unwrap()
            .stdout;
        let cargo_path = Path::new(std::str::from_utf8(&output).unwrap().trim());
        cargo_path.parent().unwrap().to_path_buf()
    }

    /// Utility to get the wasm bytes from the name, ddrectory and path
    pub fn get_wasm_bytes(name: &str) -> io::Result<Vec<u8>> {
        let workspace = workspace_dir();
        let wasm_path = format!("target/wasm32-wasi/debug/{}.wasm", name);
        let wasm_path = workspace.join(wasm_path);
        std::fs::read(wasm_path)
    }
}
