#![allow(clippy::needless_return)] // tokio_test gives annoying clippy error (r_a compiler bug?)

pub(crate) mod bindgen {
    // Use the WIT world named ipns-pubsub at ./wit
    wasmtime::component::bindgen!({
        async: true
    });
}

use super::Error;

use anyhow::Result;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{DirPerms, FilePerms, ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

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

        // ensure the HOST PATH exists, if not, create it
        std::fs::create_dir_all(&env.host_path)?;

        let wasi = WasiCtxBuilder::new()
            .inherit_stdio()
            .inherit_stdout()
            .envs(&env.vars.unwrap_or_default())
            .preopened_dir(&env.host_path, ".", DirPerms::all(), FilePerms::all())?
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
    host_path: PathBuf,
}

impl<T: Default + Send + Clone> Environment<T> {
    /// Creates a new [Environment]
    pub fn new(host_path: PathBuf) -> Result<Self, Error> {
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
            host_path,
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
        let host = "./test_plugins";
        let host_path: PathBuf = Path::new(host).to_path_buf();

        // time execution
        let wasm_path = utils::get_wasm_path("extension-echo")?;
        let wasm_bytes = std::fs::read(wasm_path.clone())?;

        let msg = Message {
            topic: "topic".to_string(),
            peer: "peer".to_string(),
            data: vec![1, 2, 3],
        };

        let env = Environment::<State>::new(host_path.clone())?;
        let _env = env.with_vars(vec![
            ("NAME".to_owned(), "Doug".to_owned()),
            ("AGE".to_owned(), "42".to_owned()),
        ]);

        let env = Environment::new(host_path)?.with_vars(vec![
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

        std::fs::remove_dir_all(env.host_path)?;

        Ok(())
    }
}
