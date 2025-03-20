#![cfg(target_arch = "wasm32")]
use futures::{
    channel::{mpsc, oneshot},
    StreamExt,
};
use peerpiper::core::{Block, Commander, Multiaddr, RawBlakeBlock};
use peerpiper::{
    core::events::{Events, PublicEvent},
    Protocol, StartConfig,
};
use peerpiper_browser::opfs::OPFSBlockstore;
use peerpiper_browser::Blockstore;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;

#[wasm_bindgen]
pub async fn run_test_wasm(libp2p_endpoint: String, cid: String) -> Result<(), JsValue> {
    tracing_wasm::set_as_global_default();
    tracing::info!(
        "Running wasm test with libp2p endpoint: {}",
        libp2p_endpoint
    );

    let (tx, mut rx) = mpsc::channel(16);
    let (command_sender, command_receiver) = tokio::sync::mpsc::channel(8);
    let (tx_client, rx_client) = oneshot::channel();

    let mut remote_maddr =
        Multiaddr::try_from(libp2p_endpoint.clone()).expect("Failed to parse Multiaddr");

    let Some(Protocol::P2p(remote_peer_id)) = remote_maddr.pop() else {
        return Err(JsError::new("Failed to parse Multiaddr").into());
    };

    let libp2p_endpoints = vec![libp2p_endpoint.clone()];
    let blockstore = OPFSBlockstore::new().await.unwrap();

    let block = RawBlakeBlock(vec![69, 69, 69, 69, 69]);
    let browser_cid = block.cid().unwrap();

    debug_assert_eq!(
        browser_cid.to_string(),
        "bafkr4iahcgbbgcbzj7w5uwzyp3bqjdnfd33d7wlxh5fqmnrtk3jpi2h5cm"
    );

    // put the block in the blockstore
    // before we even connect, to ensure it's available
    blockstore
        .put_keyed(&browser_cid, block.data())
        .await
        .unwrap();

    let mut commander = Commander::new(blockstore.clone());

    spawn_local(async move {
        peerpiper::start(
            tx,
            command_receiver,
            tx_client,
            blockstore,
            StartConfig {
                libp2p_endpoints,
                base_path: None,
                protocols: vec![],
            },
        )
        .await
        .expect("never end")
    });

    let client_handle = rx_client.await.unwrap();

    commander
        .with_network(command_sender.clone())
        .with_client(client_handle);

    // await rx until Event: Outer(NewConnection { peer }
    while let Some(event) = rx.next().await {
        tracing::debug!("Rx BINDGEN Event: {:?}", event);
        if let Events::Outer(PublicEvent::NewConnection { peer }) = event {
            tracing::info!("Connected to {:?}", peer);
            // Test functions that require the connection, like pubsub and unsubscribe
            spawn_local(async move {
                peerpiper::core::events::test_helpers::test_all_commands(
                    commander,
                    cid,
                    remote_peer_id,
                )
                .await;
            });

            break;
        }
    }

    while let Some(event) = rx.next().await {
        tracing::debug!("Rx BINDGEN Event: {:?}", event);
    }

    tracing::info!("Done test");
    Ok(())
}
