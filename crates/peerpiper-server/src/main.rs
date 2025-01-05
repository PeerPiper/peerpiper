#![feature(async_closure)]
#![allow(clippy::needless_return)]

#[cfg(feature = "cloudflare")]
mod cloudflare;
mod web_server;

use anyhow::Result;
use peerpiper_plugins::tokio::{ExternalEvents, PluggablePiper};
use std::path::PathBuf;

/// The plugins directory
const PLUGINS_DIR: &str = "plugins";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "info,peerpiper_core=debug,interop_tests_native=debug,peerpiper_native=debug,libp2p_webrtc=off,libp2p_ping=debug,libp2p_gossipsub=info",
        )
        .try_init();

    tracing::info!("Starting peerpiper-server");

    let (mut pluggable, command_receiver, mut pluggable_client, mut plugin_evts) =
        PluggablePiper::new();

    // task for listening on plugin events and updating the log accoringly
    tokio::task::spawn(async move {
        while let Some(event) = plugin_evts.recv().await {
            if let ExternalEvents::Address(addr) = event {
                // handle the new address
                tracing::debug!("Received Node Address: {:?}", addr);
                // Serve .wasm, .js and server multiaddress over HTTP on this address.
                tokio::spawn(web_server::serve(addr.clone()));
                #[cfg(feature = "cloudflare")]
                if let Err(e) = cloudflare::add_address(&addr).await {
                    tracing::error!("Could not add address to cloudflare DNS record: {e}");
                }
            }
        }
    });

    // Use WIT component handlers here.
    let mut load_plugins = async |wasms: &[PathBuf]| {
        let Ok(path) = std::env::current_dir() else {
            return;
        };

        for wasm in wasms.iter() {
            let path = path.join(wasm);
            tracing::info!("Loading wasm file: {:?}", path);
            let wasm_bytes = std::fs::read(&path).unwrap();
            if let Err(e) = pluggable_client
                .load_plugin(
                    path.file_stem()
                        .unwrap_or_default()
                        .to_str()
                        .unwrap_or_default()
                        .to_string(),
                    &wasm_bytes,
                )
                .await
            {
                tracing::error!("Error loading plugin: {:?}", e);
            }
        }
    };

    // every *.wasm file in the ./plugins directory, if any
    let wasms = match std::fs::read_dir(PLUGINS_DIR) {
        Ok(dir) => dir
            .filter_map(|entry| {
                let entry = entry.ok()?;
                let path = entry.path();
                if path.extension()?.to_str()? == "wasm" {
                    Some(path)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>(),
        Err(e) => {
            // just return empty vec if error reading plugins directory
            tracing::error!("Error reading plugins directory: {:?}", e);
            Vec::new()
        }
    };

    load_plugins(&wasms).await;

    let blockstore = {
        let lock = pluggable_client.commander.lock().await;
        let Some(commander) = lock.as_ref() else {
            return Err(
                "Commander, thus blockstore, not initialized. Need a Blockstore for bitswap."
                    .into(),
            );
        };
        commander.blockstore.clone()
    };

    pluggable
        .run(command_receiver, blockstore)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("Failed to run PluggablePiper: {:?}", e);
        });

    tracing::info!("Shutting down...");

    Ok(())
}
