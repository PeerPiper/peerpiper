//! Test should start a peerpiper instance
//! so that the plugin can call various functions
//! and verify the results.

use std::path::{Path, PathBuf};
use tempfile::tempdir;

// First one we are going to do is GetRecord from DHT.
// We can put a record in the DHT and then get it back.
use peerpiper::{AllCommands, ReturnValues};
use peerpiper_native::NativeBlockstoreBuilder;
use peerpiper_plugins::layer::PluggablePeerPiper;

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
mod tests {
    use futures::{
        channel::{mpsc, oneshot},
        StreamExt as _,
    };
    use peerpiper::core::events::PublicEvent;
    use peerpiper_native::StartConfig;
    use wasm_component_layer::{List, ListType, Value, ValueType};

    use super::*;

    #[tokio::test]
    //#[tracing_test::traced_test]
    async fn test_wasm_component_layer_instance() -> Result<(), Box<dyn std::error::Error>> {
        let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "interop_tests_plugin=debug,peerpiper_native=debug,peerpiper_core=debug,libp2p_webrtc=info,libp2p_ping=debug,beetswap=trace,peerpiper_plugins=debug,peerpiper=debug",
        )
        .try_init();

        // get the target/wasm32-wasi/debug/CARGO_PKG_NAME.wasm file
        let pkg_name = std::env::var("CARGO_PKG_NAME").unwrap().replace('-', "_");
        let wasm_filename = format!("{}.wasm", pkg_name);
        let workspace = workspace_dir();

        tracing::info!("Workspace: {:?}", workspace);
        tracing::info!("Wasm filename: {:?}", wasm_filename);

        let wasm_path = format!("target/wasm32-unknown-unknown/release/{}", wasm_filename);
        let wasm_path = workspace.join(wasm_path);

        let bytes = std::fs::read(wasm_path).unwrap();

        let tempdir = tempdir().unwrap().path().to_path_buf();
        let blockstore = NativeBlockstoreBuilder::new(tempdir).open().await.unwrap();

        // Create a channel for graceful shutdown
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let (tx_net_evt, mut rx_net_evt) = mpsc::channel(16);

        let (mut pluggable_piper, client) = PluggablePeerPiper::new(blockstore, tx_net_evt);
        pluggable_piper.load(&wasm_filename, &bytes);

        assert_eq!(pluggable_piper.plugins.len(), 1);

        let commander = pluggable_piper.peerpiper.commander.clone();
        let plugins = pluggable_piper.plugins.clone();

        let (connected, is_connected) = oneshot::channel();

        let task_handle = tokio::spawn(async move {
            // Run until either the task completes or shutdown signal is received
            tokio::select! {
                res = pluggable_piper.run(connected) => res.unwrap(),
                _ = shutdown_rx => {
                    tracing::info!("Received shutdown signal, terminating background task");
                    return;
                }
            }
        });

        let address = if let Some(evt) = rx_net_evt.next().await {
            if let PublicEvent::ListenAddr { address, .. } = evt {
                tracing::info!(%address, "RXD Address");
                address
            } else {
                panic!("Expected a ListenAddr event");
            }
        } else {
            panic!("No network events received");
        };

        // Wait for the network to be connected
        is_connected.await.unwrap();

        tracing::info!("Started. Address: {:?}", address);

        // Start the tests
        let maybe_plugin = plugins.get(&wasm_filename);

        assert!(maybe_plugin.is_some());

        let plugin = maybe_plugin.unwrap();
        let mut lock = plugin.lock().await;
        // construct the component "[constructor]component""
        let res = lock.construct();

        assert!(res.is_ok());

        // call the method
        let res = lock.call_method("run-tests", &[])?.unwrap();

        let msg = "[wasm] Running tests.";

        if let Value::String(s) = res {
            assert_eq!(s, msg.into());
        } else {
            panic!("Expected a stringified value.");
        }

        // call put_record
        let key = vec![1, 2, 3];
        let key_value = Value::List(
            List::new(
                ListType::new(ValueType::U8),
                key.to_vec()
                    .iter()
                    .map(|u| Value::U8(*u))
                    .collect::<Vec<_>>(),
            )
            .unwrap(),
        );

        let value = vec![4, 5, 6];

        let value_value = Value::List(
            List::new(
                ListType::new(ValueType::U8),
                value
                    .to_vec()
                    .iter()
                    .map(|u| Value::U8(*u))
                    .collect::<Vec<_>>(),
            )
            .unwrap(),
        );

        let Ok(_) = lock.call_method("put-record", &[key_value, value_value]) else {
            panic!("Expected a successful return value.");
        };

        // wait 1 second
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;

        // check the DHT for the record
        // can be accessed with the api call GetRecord
        let ret_val = commander
            .lock()
            .await
            .order(AllCommands::GetRecord { key })
            .await?;

        let ReturnValues::Data(data) = ret_val else {
            panic!("Expected a data return value.");
        };

        assert_eq!(data, value);

        // Send shutdown signal to terminate the background task
        shutdown_tx
            .send(())
            .expect("Failed to send shutdown signal");

        // Allow a brief moment for cleanup to complete
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        Ok(())
    }
}
