mod bindgen {
    // Use the WIT world named ipns-pubsub at ./wit
    wasmtime::component::bindgen!({
        async: true
    });
}

use crate::utils;

use anyhow::Result;
use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

lazy_static::lazy_static! {
    static ref ENGINE: Engine = {
        let mut config = Config::new();
        config.wasm_backtrace_details(wasmtime::WasmBacktraceDetails::Enable);
        config.wasm_component_model(true);
        config.async_support(true);

        Engine::new(&config).unwrap()
    };
}

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
    component: Component,
    wasi_ctx: MyCtx,
) -> Result<(Store<MyCtx>, bindgen::ExtensionWorld)> {
    let mut linker = Linker::new(&ENGINE);

    // add wasi io, filesystem, clocks, cli_base, random, poll
    wasmtime_wasi::add_to_linker_async(&mut linker)?;

    // link OUR imports, if applicable
    //bindgen::ExtensionWorld::add_to_linker(&mut linker, |x| x)?;

    let mut store = Store::new(&ENGINE, wasi_ctx);

    let reactor =
        bindgen::ExtensionWorld::instantiate_async(&mut store, &component, &linker).await?;
    Ok((store, reactor))
}

#[cfg(test)]
mod tests {

    use super::*;
    use bindgen::exports::component::extension::handlers::Message;
    use wasmtime_wasi::{DirPerms, FilePerms};

    #[tokio::test]
    async fn test_tokio_two() -> Result<(), Box<dyn std::error::Error>> {
        // time execution
        let wasm_path = utils::get_wasm_path("extension-echo")?;

        let start = std::time::Instant::now();

        let component = Component::from_file(&ENGINE, &wasm_path)?;

        // time to read file
        let last = start.elapsed();
        eprintln!("Time elapsed in reading file is: {:?}", last);

        let guest_path = ".";
        let mut table = ResourceTable::new();
        let wasi = WasiCtxBuilder::new()
            .args(&["gussie", "sparky", "willa"])
            .preopened_dir(HOST_PATH, guest_path, DirPerms::all(), FilePerms::all())?
            .build();

        let (mut store, reactor) = instantiate(
            component,
            MyCtx {
                hit: false,
                wasi_ctx: Context { table, wasi },
            },
        )
        .await?;

        // time to load
        eprintln!(
            "Time elapsed in loading is: {:?} (+{:?})",
            start.elapsed(),
            start.elapsed() - last
        );
        let last = start.elapsed();

        let secret = vec![1, 2, 3];
        let cid = "QmHashSomeCid".to_string();

        let msg = Message {
            topic: "topic".to_string(),
            peer: "peer".to_string(),
            data: vec![1, 2, 3],
        };
        eprintln!("Published message: {:?}", msg);

        let r = reactor
            .component_extension_handlers()
            .call_handle_message(&mut store, &msg.clone())
            .await??;

        //let r_2 = reactor
        //    .component_extension_handlers()
        //    .call_handle_request(&mut store, &[1, 2, 3])
        //    .await??;

        Ok(())
    }
}
