//! A module to test the edwards-wit component in Rust.
//!
//! Note: In order for this to run, we need to include the WIT dependencies in ./wit/deps/*,
//! which is copy and paste from the source directory.
mod bindgen {
    // name of the world in the .wit file
    wasmtime::component::bindgen!("peerpiper");
}

use std::{
    env,
    path::{Path, PathBuf},
};
use thiserror::Error;
use wasmtime::component::{Component, Linker, ResourceTable};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::preview2::{WasiCtx, WasiCtxBuilder, WasiView};

use bindgen::exports::peerpiper::wallet::wurbo_out::Context as WalletContext;

struct MyCtx {
    wasi_ctx: Context,
}

struct Context {
    table: ResourceTable,
    wasi: WasiCtx,
}
impl WasiView for MyCtx {
    fn table(&self) -> &ResourceTable {
        &self.wasi_ctx.table
    }
    fn table_mut(&mut self) -> &mut ResourceTable {
        &mut self.wasi_ctx.table
    }
    fn ctx(&self) -> &WasiCtx {
        &self.wasi_ctx.wasi
    }
    fn ctx_mut(&mut self) -> &mut WasiCtx {
        &mut self.wasi_ctx.wasi
    }
}

// /// Implementing this trait gives us
// /// - the ability to add_to_linker using SeedKeeper::add_to_linker
// /// - call get_seed from inside out component
// ///
// /// Normally this would be implemented by another WIT component that is composed with this
// /// component, but for testing we mock it up below.
// impl bindgen::peerpiper::edwards_ui::wurbo_types::Host for MyCtx {}
//
// impl bindgen::peerpiper::edwards_ui::wurbo_out::Host for MyCtx {
//     fn render(
//         &mut self,
//         _ctx: bindgen::peerpiper::edwards_ui::wurbo_out::Context,
//     ) -> wasmtime::Result<Result<String, String>> {
//         // return some html as string
//         Ok(Ok("edwards ui for testing".to_string()))
//     }
//
//     fn activate(&mut self) -> wasmtime::Result<()> {
//         Ok(())
//     }
// }

impl bindgen::seed_keeper::wit_ui::wurbo_types::Host for MyCtx {}
impl bindgen::seed_keeper::wit_ui::wurbo_out::Host for MyCtx {
    fn render(
        &mut self,
        _ctx: bindgen::seed_keeper::wit_ui::wurbo_out::Context,
    ) -> wasmtime::Result<Result<String, String>> {
        // return some html as string
        Ok(Ok("seed keeper ui for testing".to_string()))
    }

    fn activate(&mut self, _selectors: Option<Vec<String>>) -> wasmtime::Result<()> {
        Ok(())
    }
}

impl bindgen::delano::wit_ui::context_types::Host for MyCtx {}
impl bindgen::delano::wit_ui::wurbo_out::Host for MyCtx {
    fn render(
        &mut self,
        _ctx: bindgen::delano::wit_ui::wurbo_out::Context,
    ) -> wasmtime::Result<Result<String, String>> {
        // return some html as string
        Ok(Ok("delano ui for testing".to_string()))
    }

    fn activate(&mut self, _selectors: Option<Vec<String>>) -> wasmtime::Result<()> {
        Ok(())
    }
}

impl bindgen::peerpiper::wallet::context_types::Host for MyCtx {}
impl bindgen::peerpiper::wallet::wurbo_in::Host for MyCtx {
    fn addeventlistener(
        &mut self,
        _details: bindgen::peerpiper::wallet::wurbo_in::ListenDetails,
    ) -> wasmtime::Result<()> {
        Ok(())
    }

    /// Sets location hash (stub)
    fn set_hash(&mut self, _hash: String) -> wasmtime::Result<()> {
        Ok(())
    }

    /// Emits an event (stub)
    fn emit(&mut self, _event: String) -> wasmtime::Result<()> {
        Ok(())
    }
}

#[derive(Error, Debug)]
pub enum TestError {
    /// From String
    #[error("Error message {0}")]
    Stringified(String),

    /// From Wasmtime
    #[error("Wasmtime: {0}")]
    Wasmtime(#[from] wasmtime::Error),

    /// From VarError
    #[error("VarError: {0}")]
    VarError(#[from] std::env::VarError),

    /// From io
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
}

impl From<String> for TestError {
    fn from(s: String) -> Self {
        TestError::Stringified(s)
    }
}

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

#[cfg(test)]
mod aggregate_peerpiper_tests {

    use crate::bindgen::{
        delano::wit_ui::context_types,
        peerpiper::wallet::context_types::{App, Content, DelanoContext, SeedContext},
        seed_keeper::wit_ui::wurbo_types::Page,
    };

    use super::*;

    #[test]
    fn test_initial_load() -> wasmtime::Result<(), TestError> {
        // get the target/wasm32-wasi/debug/CARGO_PKG_NAME.wasm file
        let pkg_name = std::env::var("CARGO_PKG_NAME")?.replace('-', "_");
        let workspace = workspace_dir();
        let wasm_path = format!("target/wasm32-wasi/debug/{}.wasm", pkg_name);
        let wasm_path = workspace.join(wasm_path);

        let mut config = Config::new();
        config.cache_config_load_default()?;
        config.wasm_backtrace_details(wasmtime::WasmBacktraceDetails::Enable);
        config.wasm_component_model(true);

        let engine = Engine::new(&config)?;
        let component = Component::from_file(&engine, &wasm_path)?;

        let mut linker = Linker::new(&engine);
        // link imports like get_seed to our instantiation
        bindgen::Peerpiper::add_to_linker(&mut linker, |state: &mut MyCtx| state)?;
        // link the WASI imports to our instantiation
        wasmtime_wasi::preview2::command::sync::add_to_linker(&mut linker)?;

        let table = ResourceTable::new();
        let wasi: WasiCtx = WasiCtxBuilder::new().inherit_stdout().args(&[""]).build();
        let state = MyCtx {
            wasi_ctx: Context { table, wasi },
        };
        let mut store = Store::new(&engine, state);

        let (bindings, _) = bindgen::Peerpiper::instantiate(&mut store, &component, &linker)?;

        // Use bindings
        // Call render with initial data, should return all HTML
        // Initial data is WIT variant represented in JSON:
        // Now we should be able to pass this content as context to render()

        let seed_ui = SeedContext::AllContent(bindgen::seed_keeper::wit_ui::wurbo_types::Content {
            page: Some(Page {
                title: "a title for the page".to_string(),
            }),
            input: Some(bindgen::seed_keeper::wit_ui::wurbo_types::Input {
                placeholder: "a placeholder".to_string(),
                encrypted_seed: None,
            }),
            load: None,
        });

        let delano_ui =
            DelanoContext::AllContent(bindgen::delano::wit_ui::context_types::Everything {
                page: Some(context_types::Page {
                    name: "a title for the page".to_string(),
                    version: "0.1.0".to_string(),
                    description: "Delanocreds wallet.".to_string(),
                }),
                load: None,
            });

        let all_context = WalletContext::AllContent(Content {
            app: Some(App {
                title: Some("a title for the app".to_string()),
            }),
            seed_ui: Some(seed_ui.clone()),
            delano_ui: Some(delano_ui.clone()),
        });

        let result = bindings
            .peerpiper_wallet_wurbo_out()
            .call_render(&mut store, &all_context)?
            .expect("render should work in success tests");

        // The result should be a string of HTML
        eprintln!("result: {}", result);

        // should be able to also call aggregation_activate()
        bindings
            .peerpiper_wallet_aggregation()
            .call_activates(&mut store, None)?;

        // now pass
        // only seed_ui as context for render, should get only seed UI HTML
        let result = bindings
            .peerpiper_wallet_wurbo_out()
            .call_render(&mut store, &WalletContext::Seed(seed_ui))?
            .expect("render should work in success tests");

        eprintln!("seed_ui result: {}", result);

        Ok(())
    }
}
