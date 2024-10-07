//! The extension module setups up the WIT component boilerplate code.
//! Follows similar pattern to ../../extension-echo/tests/mod.rs for testing.
mod bindgen {
    wasmtime::component::bindgen!();
}

pub use bindgen::exports::component::extension::handlers::Message;

use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{DirPerms, FilePerms, ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

/// The host path for saving files
const HOST_PATH: &str = "./exts";

/// MyCtx struct to hold the WASI context
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

/// ExtensionsBuilder struct to build the Extensions struct
pub struct ExtensionsBuilder<T> {
    /// Engine to run the wasm extensions
    engine: Engine,

    /// Vector of wasm bytes for each extension
    wasm_bytes: Vec<Vec<u8>>,

    /// Linker to link the wasm extensions
    linker: Linker<T>,

    /// Store to run the wasm extensions
    store: Store<T>,
}

/// Extension struct to hold the wasm extension files
pub struct Extensions {
    /// The built bindings for the wasm extensions
    bindings: Vec<bindgen::ExtensionWorld>,

    /// The store to run the wasm extensions
    store: Store<MyCtx>,
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

        // ensure the HOST_PATH exists, if not, create it
        std::fs::create_dir_all(HOST_PATH)?;

        let guest_path = ".";

        // Create a WASI context and add it to the store
        let wasi = WasiCtxBuilder::new()
            .inherit_stdio()
            .inherit_stdout()
            .args(&[""])
            .preopened_dir(HOST_PATH, guest_path, DirPerms::all(), FilePerms::all())?
            .build();

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
    pub(crate) fn build(mut self) -> Result<Extensions, Box<dyn std::error::Error>> {
        let bindings = self
            .wasm_bytes
            .iter()
            .map(|wasm_bytes| {
                let component = Component::from_binary(&self.engine, wasm_bytes)?;
                bindgen::ExtensionWorld::instantiate(&mut self.store, &component, &self.linker)
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(Extensions {
            bindings,
            store: self.store,
        })
    }
}

impl Extensions {
    /// Handles a [Message] by sending it to the wasm function
    pub(crate) fn handle_message(
        &mut self,
        msg: Message,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // iterate over the bindings and call the wasm function
        // for each binding, return the responses
        for binding in &self.bindings {
            let result = binding
                .component_extension_handlers()
                .call_handle_message(&mut self.store, &msg)??;
            println!("Bindings output: {}", result);
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_handle_message() {
        let wasm_path = utils::get_wasm_path("extension-echo").unwrap();
        let wasm_bytes = std::fs::read(wasm_path).unwrap();

        let mut builder = ExtensionsBuilder::new().unwrap();
        builder.with_wasm(wasm_bytes);
        let mut extensions = builder.build().unwrap();

        assert_eq!(extensions.bindings.len(), 1);

        let msg = Message {
            topic: "topic".to_string(),
            peer: "peer".to_string(),
            data: vec![1, 2, 3],
        };
        extensions.handle_message(msg).unwrap();
    }
}
