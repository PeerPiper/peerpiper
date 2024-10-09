pub(crate) mod bindgen {
    // Use the WIT world named ipns-pubsub at ./wit
    wasmtime::component::bindgen!({
        async: true
    });
}

use crate::error::Error;
use crate::utils;

use anyhow::Result;
use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{DirPerms, FilePerms, ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

/// The host path for saving files
const HOST_PATH: &str = "./exts";

/// Struct to hold the data we want to pass in
/// plus the WASI properties in order to use WASI
pub struct MyCtx {
    hit: bool,
    wasi_ctx: Context,
}

struct Context {
    table: ResourceTable,
    wasi: WasiCtx,
}

// We need to impl to be able to use the WASI linker add_to_linker
impl WasiView for MyCtx {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.wasi_ctx.table
    }
    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.wasi_ctx.wasi
    }
}

/// Helper function to abstract the instantiation of the WASM module
pub async fn instantiate(
    engine: Engine,
    component: Component,
    wasi_ctx: MyCtx,
) -> Result<(Store<MyCtx>, bindgen::ExtensionWorld)> {
    let mut linker = Linker::new(&engine);

    // add wasi io, filesystem, clocks, cli_base, random, poll
    wasmtime_wasi::add_to_linker_async(&mut linker)?;

    // link OUR imports, if applicable
    //bindgen::ExtensionWorld::add_to_linker(&mut linker, |x| x)?;

    let mut store = Store::new(&engine, wasi_ctx);

    let reactor =
        bindgen::ExtensionWorld::instantiate_async(&mut store, &component, &linker).await?;
    Ok((store, reactor))
}

struct PluginsBuilder<T> {
    engine: Engine,
    wasm_bytes: Vec<Vec<u8>>,
    linker: Linker<T>,
    store: Store<T>,
}

impl PluginsBuilder<MyCtx> {
    /// Creates a new [ExtensionsBuilder]
    ///
    /// to which you can add wasm files that you want to use as extensions
    pub fn new() -> Result<Self, Error> {
        let mut config = Config::new();
        config.wasm_backtrace_details(wasmtime::WasmBacktraceDetails::Enable);
        config.wasm_component_model(true);
        config.async_support(true);

        let engine = Engine::new(&config).unwrap();
        let mut linker = Linker::new(&engine);

        let guest_path = ".";
        let table = ResourceTable::new();
        let wasi = WasiCtxBuilder::new()
            .args(&["gussie", "sparky", "willa"])
            .preopened_dir(HOST_PATH, guest_path, DirPerms::all(), FilePerms::all())?
            .build();

        let state = MyCtx {
            hit: false,
            wasi_ctx: Context { table, wasi },
        };

        let store = Store::new(&engine, state);

        // add wasi io, filesystem, clocks, cli_base, random, poll
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        Ok(Self {
            engine,
            wasm_bytes: vec![],
            linker,
            store,
        })
    }

    /// Adds a new wasm file to the extensions struct
    pub fn with_wasm(&mut self, wasm_bytes: Vec<u8>) {
        self.wasm_bytes.push(wasm_bytes);
    }

    /// Build by instantiating the wasm extensions
    pub async fn build(mut self) -> Result<Plugins, Error> {
        let wasm_byte = self.wasm_bytes.pop().unwrap();
        let component = Component::from_binary(&self.engine, &wasm_byte)?;

        let bindings =
            bindgen::ExtensionWorld::instantiate_async(&mut self.store, &component, &self.linker)
                .await?;

        Ok(Plugins {
            bindings: vec![bindings],
            store: self.store,
        })
    }
}

/// Extension struct to hold the wasm extension files
pub struct Plugins {
    /// The built bindings for the wasm extensions
    pub bindings: Vec<bindgen::ExtensionWorld>,

    /// The store to run the wasm extensions
    store: Store<MyCtx>,
}

#[cfg(test)]
mod tests {

    use super::*;
    use bindgen::exports::component::extension::handlers::Message;

    #[tokio::test]
    async fn test_tokio_two() -> Result<(), Box<dyn std::error::Error>> {
        // time execution
        let wasm_path = utils::get_wasm_path("extension-echo")?;
        let wasm_bytes = std::fs::read(wasm_path.clone())?;

        let mut builder = PluginsBuilder::new()?;
        builder.with_wasm(wasm_bytes);
        let mut plugins = builder.build().await?;

        let msg = Message {
            topic: "topic".to_string(),
            peer: "peer".to_string(),
            data: vec![1, 2, 3],
        };

        let _r = plugins
            .bindings
            .pop()
            .unwrap()
            .component_extension_handlers()
            .call_handle_message(&mut plugins.store, &msg.clone())
            .await??;

        Ok(())
    }
}
