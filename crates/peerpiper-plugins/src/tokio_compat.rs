#![allow(clippy::needless_return)] // tokio_test gives annoying clippy error (r_a compiler bug?)

pub(crate) mod bindgen {
    // Use the WIT world named ipns-pubsub at ./wit
    wasmtime::component::bindgen!({
        async: true
    });
}

use super::Error;

use anyhow::Result;
use std::sync::Arc;
use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{DirPerms, FilePerms, ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

/// The host path for saving files
const HOST_PATH: &str = "./plugin_data";

/// Struct to hold the data we want to pass in
/// plus the WASI properties in order to use WASI
pub struct MyCtx<T: Default> {
    /// This data can be accessed from [Store] by using the data method(s)
    #[allow(dead_code)]
    inner: T,
    wasi_ctx: Context,
}

impl<T: Default> Default for MyCtx<T> {
    fn default() -> Self {
        let table = ResourceTable::new();
        let wasi = WasiCtxBuilder::new().build();
        Self {
            inner: Default::default(),
            wasi_ctx: Context { table, wasi },
        }
    }
}

struct Context {
    table: ResourceTable,
    wasi: WasiCtx,
}

// We need to impl to be able to use the WASI linker add_to_linker
impl<T: Default + Send> WasiView for MyCtx<T> {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.wasi_ctx.table
    }
    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.wasi_ctx.wasi
    }
}

// /// [PluginsBuilder] struct to build the [Plugins] struct
// pub struct PluginsBuilder<T> {
//     engine: Engine,
//     wasm_bytes: Vec<Vec<u8>>,
//     linker: Linker<T>,
//     store: Arc<Mutex<Store<T>>>,
// }
//
// impl<T: Default + Send> PluginsBuilder<MyCtx<T>> {
//     /// Creates a new [ExtensionsBuilder]
//     ///
//     /// to which you can add wasm files that you want to use as extensions
//     pub fn new() -> Result<Self, Error> {
//         let mut config = Config::new();
//         config.wasm_backtrace_details(wasmtime::WasmBacktraceDetails::Enable);
//         config.wasm_component_model(true);
//         config.async_support(true);
//
//         let engine = Engine::new(&config).unwrap();
//         let mut linker = Linker::new(&engine);
//
//         let guest_path = ".";
//         let table = ResourceTable::new();
//         let wasi = WasiCtxBuilder::new()
//             .inherit_stdio()
//             .inherit_stdout()
//             .args(&["gussie", "sparky", "willa"])
//             .preopened_dir(HOST_PATH, guest_path, DirPerms::all(), FilePerms::all())?
//             .build();
//
//         let state = MyCtx {
//             inner: Default::default(),
//             wasi_ctx: Context { table, wasi },
//         };
//
//         let store = Store::new(&engine, state);
//
//         // add wasi io, filesystem, clocks, cli_base, random, poll
//         wasmtime_wasi::add_to_linker_async(&mut linker)?;
//
//         Ok(Self {
//             engine,
//             wasm_bytes: vec![],
//             linker,
//             store: Arc::new(Mutex::new(store)),
//         })
//     }
//
//     /// Adds a new wasm file to the extensions struct
//     pub fn with_wasm(&mut self, wasm_bytes: Vec<u8>) {
//         self.wasm_bytes.push(wasm_bytes);
//     }
//
//     /// Build by instantiating the wasm extensions
//     pub async fn build(self) -> Result<Plugins, Error> {
//         let mut set: JoinSet<Result<bindgen::ExtensionWorld, Error>> = JoinSet::new();
//
//         // for each wasm_bytes, generate the bindings. instantiate_async is async, so it needs to be awaited
//         for wasm_bytes in self.wasm_bytes {
//             let component = Component::from_binary(&self.engine, &wasm_bytes)?;
//             let store = self.store.clone();
//             let linker = self.linker.clone();
//             set.spawn(async move {
//                 let linker = linker;
//                 let mut store = store.lock().await;
//                 let store = &mut *store;
//                 let bindings =
//                     bindgen::ExtensionWorld::instantiate_async(store, &component, &linker).await?;
//                 Ok(bindings)
//             });
//         }
//
//         let mut bindings: Vec<bindgen::ExtensionWorld> = Vec::new();
//
//         while let Some(res) = set.join_next().await {
//             let task_result = res?;
//             let final_result = task_result?;
//             bindings.push(final_result);
//         }
//
//         // ditch the store Arc and Mutux, set store to inner
//         let store: Store<MyCtx> = mem::take(&mut *self.store.lock().await.deref_mut());
//         Ok(Plugins { bindings, store })
//     }
// }

/// Extension struct to hold the wasm extension files
pub struct Plugin<T: Default> {
    /// The built bindings for the wasm extensions
    pub instance: bindgen::ExtensionWorld,

    /// The store to run the wasm extensions
    store: Store<MyCtx<T>>,
}

impl<T: Default + Send + Clone> Plugin<T> {
    /// Creates and instantiates a new [Plugin]
    pub async fn new(env: Environment<T>, wasm_bytes: &[u8], state: T) -> Result<Self, Error> {
        let component = Component::from_binary(&env.engine, wasm_bytes)?;

        // ensure the HOST_PATH exists, if not, create it
        std::fs::create_dir_all(HOST_PATH)?;

        let wasi = WasiCtxBuilder::new()
            .inherit_stdio()
            .inherit_stdout()
            .envs(&env.vars.unwrap_or_default())
            .preopened_dir(HOST_PATH, ".", DirPerms::all(), FilePerms::all())?
            .build();

        let data = MyCtx {
            inner: state,
            wasi_ctx: Context {
                table: ResourceTable::new(),
                wasi,
            },
        };
        let mut store = Store::new(&env.engine, data);

        let instance =
            bindgen::ExtensionWorld::instantiate_async(&mut store, &component, &env.linker).await?;

        Ok(Self { instance, store })
    }

    /// Handles the message
    pub async fn handle_message(
        &mut self,
        msg: &bindgen::exports::component::extension::handlers::Message,
    ) -> Result<String, Error> {
        Ok(self
            .instance
            .component_extension_handlers()
            .call_handle_message(&mut self.store, msg)
            .await??)
    }

    /// Handles requests
    pub async fn handle_request(&mut self, data: Vec<u8>) -> Result<Vec<u8>, Error> {
        Ok(self
            .instance
            .component_extension_handlers()
            .call_handle_request(&mut self.store, &data)
            .await??)
    }
}

/// [Environment] struct to hold the engine and Linker
#[derive(Clone)]
pub struct Environment<T: Default + Clone> {
    engine: Engine,
    linker: Arc<Linker<MyCtx<T>>>,
    vars: Option<Vec<(String, String)>>,
}

impl<T: Default + Send + Clone> Environment<T> {
    /// Creates a new [Environment]
    pub fn new() -> Result<Self, Error> {
        let mut config = Config::new();
        config.wasm_backtrace_details(wasmtime::WasmBacktraceDetails::Enable);
        config.wasm_component_model(true);
        config.async_support(true);

        let engine = Engine::new(&config).unwrap();
        let mut linker = Linker::new(&engine);

        // add wasi io, filesystem, clocks, cli_base, random, poll
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        Ok(Self {
            engine,
            linker: Arc::new(linker),
            vars: None,
        })
    }

    /// Sets environment variables. When used in with a plugin,
    ///
    /// # Example
    ///
    /// ```
    /// use peerpiper_plugins::tokio_compat::Environment;
    /// # use tokio_test;
    /// # tokio_test::block_on(async {
    /// /// Custom state struct, that your host functions can use
    /// #[derive(Default, Clone)]
    /// struct State {
    ///     // Your custom state goes here, if any
    /// }
    ///
    /// let env: Environment<State> = Environment::new()
    /// .unwrap()
    /// .with_vars(vec![
    ///     ("NAME".to_owned(), "Doug".to_owned()),
    ///     ("AGE".to_owned(), "42".to_owned()),
    /// ]);
    ///
    /// # });
    /// ```
    pub fn with_vars(mut self, vars: Vec<(String, String)>) -> Self {
        self.vars = Some(vars);
        self
    }
}

#[cfg(test)]
mod tests {

    use crate::utils;

    use super::*;
    use bindgen::exports::component::extension::handlers::Message;

    #[derive(Default, Clone)]
    struct State {
        hit: bool,
    }

    #[tokio::test]
    async fn test_tokio_two() -> Result<(), Box<dyn std::error::Error>> {
        // time execution
        let wasm_path = utils::get_wasm_path("extension-echo")?;
        let wasm_bytes = std::fs::read(wasm_path.clone())?;

        let msg = Message {
            topic: "topic".to_string(),
            peer: "peer".to_string(),
            data: vec![1, 2, 3],
        };

        let env = Environment::<State>::new()?;
        let _env = env.with_vars(vec![
            ("NAME".to_owned(), "Doug".to_owned()),
            ("AGE".to_owned(), "42".to_owned()),
        ]);

        let env = Environment::new()?.with_vars(vec![
            ("NAME".to_owned(), "Doug".to_owned()),
            ("AGE".to_owned(), "42".to_owned()),
        ]);

        // enumerate insteead, so we can test State hit value
        for (i, (wasm, input)) in [
            (&wasm_bytes, State { hit: true }),
            (&wasm_bytes, State { hit: false }),
        ]
        .into_iter()
        .enumerate()
        {
            let mut plugin = Plugin::new(env.clone(), wasm, input).await?;
            let response = plugin.handle_message(&msg).await?;

            let data = plugin.store.data();
            // Hello, peer! You sent me: [1, 2, 3] about topic "topic"
            assert_eq!(
                response,
                "Hello, peer! You sent me: [1, 2, 3] about topic \"topic\""
            );
            assert_eq!(data.inner.hit, i == 0);
        }

        std::fs::remove_dir_all(HOST_PATH)?;

        Ok(())
    }
}
