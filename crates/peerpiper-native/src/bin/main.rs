use futures::{
    channel::{mpsc, oneshot},
    StreamExt,
};

use peerpiper_native::NativeBlockstoreBuilder;

const MAX_CHANNELS: usize = 16;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("peerpiper_native=debug,peerpiper_native_bin=debug,peerpiper_core=debug,libp2p_webrtc=info,libp2p_ping=debug")
        .try_init();

    tracing::info!("Starting peerpiper-native BINARY");

    let (tx, mut rx) = mpsc::channel(MAX_CHANNELS);
    let (_command_sender, command_receiver) = tokio::sync::mpsc::channel(8);
    let (tx_client, _rx_client) = oneshot::channel();
    let libp2p_endpoints = vec![];
    let blockstore = NativeBlockstoreBuilder::default().open().await.unwrap();
    let protocols = Default::default();

    peerpiper_native::start(
        tx,
        command_receiver,
        tx_client,
        blockstore,
        peerpiper_native::StartConfig {
            libp2p_endpoints,
            protocols,
            base_path: None,
        },
    )
    .await?;

    loop {
        tokio::select! {
            msg = rx.next() => {
                tracing::info!("Received msg: {:?}", msg);
            }
            _ = tokio::signal::ctrl_c() => {
                tracing::info!("Received ctrl-c");
                break;
            }
        }
    }

    Ok(())
}
