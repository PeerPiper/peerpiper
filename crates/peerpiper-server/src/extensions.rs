//! The extension module setups up the WIT component boilerplate code.
//! Follows similar pattern to ../../extension-echo/tests/mod.rs for testing.
mod bindgen {
    wasmtime::component::bindgen!();
}

use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

struct MyCtx {
    table: ResourceTable,
    ctx: WasiCtx,
}

impl WasiView for MyCtx {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }

    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.ctx
    }
}

/// Struct to contain topic, peer, and data for a message
pub struct Message {
    pub topic: String,
    pub peer: String,
    pub data: Vec<u8>,
}

/// ExtensionsBuilder struct to build the Extensions struct
pub struct ExtensionsBuilder<T> {
    /// Engine to run the wasm extensions
    engine: Engine,

    /// Vector of wasm bytes for each extension
    pub wasm_bytes: Vec<Vec<u8>>,

    /// Linker to link the wasm extensions
    linker: Linker<T>,

    /// Store to run the wasm extensions
    store: Store<T>,
}

/// Extension struct to hold the wasm extension files
pub struct Extensions {
    //. The built bindings for the wasm extensions
    bindings: Vec<bindgen::ExtensionWorld>,
}

impl ExtensionsBuilder<MyCtx> {
    /// Creates a new [ExtensionsBuilder]
    ///
    /// to which you can add wasm files that you want to use as extensions
    fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let mut config = Config::new();
        config.cache_config_load_default()?;
        config.wasm_backtrace_details(wasmtime::WasmBacktraceDetails::Enable);
        config.wasm_component_model(true);

        let engine = Engine::new(&config)?;
        let mut linker = Linker::new(&engine);

        let table = ResourceTable::new();
        let wasi: WasiCtx = WasiCtxBuilder::new().inherit_stdout().args(&[""]).build();
        let state = MyCtx { table, ctx: wasi };
        let store = Store::new(&engine, state);

        // link imports like get_seed to our instantiation
        //bindgen::ExtensionWorld::add_to_linker(&mut linker, |state: &mut MyCtx| state)?;
        // link the WASI imports to our instantiation
        wasmtime_wasi::add_to_linker_sync(&mut linker)?;

        Ok(Self {
            engine,
            linker,
            store,
            wasm_bytes: Vec::new(),
        })
    }

    /// Adds a new wasm file to the extensions struct
    pub(crate) fn with_wasm(&mut self, wasm_bytes: Vec<u8>) {
        self.wasm_bytes.push(wasm_bytes);
    }

    /// Builds the [Extensions] struct bu iterating over the wasm bytes and binding them
    pub(crate) fn build(&mut self) -> Result<Extensions, Box<dyn std::error::Error>> {
        let bindings = self
            .wasm_bytes
            .iter()
            .map(|wasm_bytes| {
                let component = Component::from_binary(&self.engine, wasm_bytes)?;
                bindgen::ExtensionWorld::instantiate(&mut self.store, &component, &self.linker)
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(Extensions { bindings })
    }
}

impl Extensions {
    /// Handles a [Message] by sending it to the wasm function
    pub(crate) fn handle_message(&self, msg: Message) -> Result<(), Box<dyn std::error::Error>> {
        // send msg to wasm func
        Ok(())
    }
}

pub mod utils {
    use std::path::{Path, PathBuf};

    /// Utility function to get the workspace dir
    pub fn workspace_dir() -> PathBuf {
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

    /// Gets the wasm bytes path from the given package name
    /// Will convert the package name to snake case if it contains a hyphen
    pub fn get_wasm_path(pkg_name: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let pkg_name = pkg_name.replace('-', "_");
        let workspace = workspace_dir();
        let wasm_path = format!("target/wasm32-wasip1/debug/{pkg_name}.wasm");
        Ok(workspace.join(wasm_path))
    }
}
