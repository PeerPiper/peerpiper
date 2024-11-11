#![allow(clippy::needless_return)] // tokio_test gives annoying clippy error (r_a compiler bug?)

pub(crate) mod bindgen {
    // Use the WIT world named ipns-pubsub at ./wit
    wasmtime::component::bindgen!({
        async: true
    });
}

use crate::Error;

use anyhow::Result;
use std::ops::{Deref, DerefMut};
use std::path::PathBuf;
use std::sync::Arc;
use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{DirPerms, FilePerms, ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

/// Struct to hold the data we want to pass in
/// plus the WASI properties in order to use WASI
pub struct MyCtx<T: Inner> {
    /// This data can be accessed from [Store] by using the data method(s)
    #[allow(dead_code)]
    inner: T,
    wasi_ctx: Context,
}

impl<T: Inner> Deref for MyCtx<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl<T: Inner> DerefMut for MyCtx<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}

struct Context {
    table: ResourceTable,
    wasi: WasiCtx,
}

// We need to impl to be able to use the WASI linker add_to_linker
impl<T: Inner + Send> WasiView for MyCtx<T> {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.wasi_ctx.table
    }
    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.wasi_ctx.wasi
    }
}

impl<T: Inner + Send + Clone> bindgen::component::extension::types::Host for MyCtx<T> {}

#[wasmtime_wasi::async_trait]
impl<T: Inner + Send + Clone> bindgen::component::extension::peer_piper_commands::Host
    for MyCtx<T>
{
    async fn start_providing(&mut self, key: Vec<u8>) {
        println!("MyCtx IMPL Received request: {:?}", key);
        self.inner.start_providing(key).await;
    }
}

#[wasmtime_wasi::async_trait]
impl<T: Inner + Send + Clone> bindgen::component::extension::logging::Host for MyCtx<T> {
    async fn log(&mut self, msg: String) {
        println!("MyCtx IMPL Received log: {} ", msg);
        self.inner.log(msg).await;
    }
}

/// Inner trait to be implemented by the host
#[wasmtime_wasi::async_trait]
pub trait Inner {
    /// Start providing data on the network (DHT)
    async fn start_providing(&mut self, key: Vec<u8>);

    /// Log a message
    async fn log(&mut self, msg: String);
}

/// Extension struct to hold the wasm extension files
pub struct Plugin<T: Inner> {
    /// The built bindings for the wasm extensions
    pub instance: bindgen::ExtensionWorld,

    /// The store to run the wasm extensions
    store: Store<MyCtx<T>>,
}

impl<T: Inner + Send + Clone> Plugin<T> {
    /// Creates and instantiates a new [Plugin]
    pub async fn new(
        env: Environment<T>,
        name: &str,
        wasm_bytes: &[u8],
        state: T,
    ) -> Result<Self, Error> {
        let component = Component::from_binary(&env.engine, wasm_bytes)?;

        // ensure the HOST PATH / name exists, if not, create it
        let host_plugin_path_name = env.host_path.join(name);
        tracing::info!("Creating host plugin path: {:?}", host_plugin_path_name);
        std::fs::create_dir_all(&host_plugin_path_name)?;

        let wasi = WasiCtxBuilder::new()
            .inherit_stdio()
            .inherit_stdout()
            .envs(&env.vars.unwrap_or_default())
            .preopened_dir(
                &host_plugin_path_name,
                ".",
                DirPerms::all(),
                FilePerms::all(),
            )?
            .build();

        let data = MyCtx {
            inner: state,
            wasi_ctx: Context {
                table: ResourceTable::new(),
                wasi,
            },
        };
        let mut store = Store::new(&env.engine, data);

        // get a &mut linker by deref muting it
        // let lnkr = &mut *env.linker.clone();
        // let lnkr = &mut (*env.linker).clone();
        // bindgen::ExtensionWorld::add_to_linker(lnkr, |state: &mut MyCtx<T>| state)?;

        let instance =
            bindgen::ExtensionWorld::instantiate_async(&mut store, &component, &env.linker).await?;

        Ok(Self { instance, store })
    }

    /// Access to the inner state, the T in self.store: Store<MyCtx<T>>.
    pub fn state(&self) -> &T {
        &self.store.data().inner
    }

    /// Handles the message
    pub async fn handle_message(
        &mut self,
        msg: &bindgen::exports::component::extension::handlers::Message,
    ) -> Result<String, super::error::Error> {
        Ok(self
            .instance
            .component_extension_handlers()
            .call_handle_message(&mut self.store, msg)
            .await??)
    }

    /// Handles requests
    pub async fn handle_request(&mut self, data: Vec<u8>) -> Result<Vec<u8>, super::error::Error> {
        Ok(self
            .instance
            .component_extension_handlers()
            .call_handle_request(&mut self.store, &data)
            .await??)
    }
}

/// [Environment] struct to hold the engine and Linker
#[derive(Clone)]
pub struct Environment<T: Inner + Clone> {
    engine: Engine,
    linker: Arc<Linker<MyCtx<T>>>,
    vars: Option<Vec<(String, String)>>,
    host_path: PathBuf,
}

impl<T: Inner + Send + Clone> Environment<T> {
    /// Creates a new [Environment]
    pub fn new(host_path: PathBuf) -> Result<Self, Error> {
        let mut config = Config::new();
        config.wasm_backtrace_details(wasmtime::WasmBacktraceDetails::Enable);
        config.wasm_component_model(true);
        config.async_support(true);

        let engine = Engine::new(&config).unwrap();
        let mut linker = Linker::new(&engine);

        bindgen::ExtensionWorld::add_to_linker(&mut linker, |state: &mut MyCtx<T>| state)?;

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
    /// use peerpiper_plugins::tokio::{Environment, Inner};
    /// use wasmtime_wasi::async_trait; // or async_trait::async_trait
    /// # use tokio_test;
    /// # use std::path::Path;
    /// # tokio_test::block_on(async {
    /// /// Custom state struct, that your host functions can use
    /// #[derive(Default, Clone)]
    /// struct State {
    ///     // Your custom state goes here, if any
    /// }
    ///
    /// #[async_trait]
    /// impl Inner for State {
    ///    async fn start_providing(&mut self, key: Vec<u8>) {
    ///    // do something with the key
    ///    }
    ///
    ///    async fn log(&mut self, msg: String) {
    ///    // log the message
    ///    }
    /// }
    ///
    /// let host_path = Path::new("./test_plugins").to_path_buf();
    /// let env: Environment<State> = Environment::new(host_path)
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
    use std::path::Path;

    #[derive(Default, Clone)]
    struct State {
        hit: bool,
    }

    #[wasmtime_wasi::async_trait]
    impl Inner for State {
        async fn start_providing(&mut self, key: Vec<u8>) {
            println!("[INNER]: State: {:?}", key);
            self.hit = true;
        }

        async fn log(&mut self, msg: String) {
            println!("[INNER]: Log: {} ", msg);
        }
    }

    #[tokio::test]
    async fn test_tokio_two() -> Result<(), Box<dyn std::error::Error>> {
        let host_path = Path::new("./test_plugins").to_path_buf();

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
            let name = format!("plugin-{}", i);
            let mut plugin = Plugin::new(env.clone(), &name, wasm, input).await?;
            let response = plugin.handle_message(&msg).await?;

            let data = plugin.store.data();
            // Hello, peer! You sent me: [1, 2, 3] about topic "topic"
            assert_eq!(
                response,
                "Hello, peer! You sent me: [1, 2, 3] about topic \"topic\""
            );
            assert_eq!(data.inner.hit, i == 0);

            // also test handle_request
            let response = plugin.handle_request(vec![1, 2, 3]).await?;
            assert_eq!(response, vec![1, 2, 3]);
        }

        std::fs::remove_dir_all(env.host_path)?;

        Ok(())
    }
}
