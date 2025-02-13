#[cfg(not(target_arch = "wasm32"))]
use anyhow::Result;
use axum::extract::{Path, State};
use axum::http::header::CONTENT_TYPE;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse};
// use axum::routing::post;
use axum::{http::Method, routing::get};
// use axum::{Json};
use axum::Router;
use futures::channel::{mpsc, oneshot};
use futures::StreamExt;
use libp2p::multiaddr::{Multiaddr, Protocol};
use peerpiper::core::{Block, Cid, Commander, RawBlakeBlock, ReturnValues};
use std::net::Ipv4Addr;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

// use std::process::Stdio;
// use thirtyfour::prelude::*;
// use tokio::io::{AsyncBufReadExt, BufReader};
// use tokio::process::Child;

use peerpiper::core::events::{AllCommands, Events, PublicEvent, SystemCommand};

const MAX_CHANNELS: usize = 16;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "interop_tests_native=debug,peerpiper_native=debug,peerpiper_core=debug,libp2p_webrtc=info,libp2p_ping=debug,beetswap=trace",
        )
        .try_init();

    tracing::info!("Starting peerpiper-native TESTS");

    let (tx_net_evt, mut rx_net_evt) = mpsc::channel(MAX_CHANNELS);
    let (command_sender, command_receiver) = tokio::sync::mpsc::channel(8);
    let tx_net_evt_clone = tx_net_evt.clone();

    let (tx_client, rx_client) = oneshot::channel();

    let libp2p_endpoints = vec![];
    let blockstore = peerpiper_native::NativeBlockstoreBuilder::default()
        .open()
        .await
        .unwrap();

    let blockstore_clone = blockstore.clone();
    let protocols = Default::default();

    tokio::spawn(async move {
        peerpiper::start(
            tx_net_evt_clone,
            command_receiver,
            tx_client,
            blockstore_clone,
            peerpiper::StartConfig {
                libp2p_endpoints,
                protocols,
                base_path: None,
            },
        )
        .await
        .unwrap();
    });

    tracing::info!("Started.");

    let address = loop {
        if let Events::Outer(PublicEvent::ListenAddr { address, .. }) =
            rx_net_evt.next().await.unwrap()
        {
            tracing::info!(%address, "RXD Address");
            break address;
        }
    };

    let client_handle = rx_client.await?;

    let mut commander = Commander::new(blockstore);
    commander
        .with_network(command_sender.clone())
        .with_client(client_handle);

    // Create a block with some data for bitswap test and put it in the blockstore
    let block = RawBlakeBlock(vec![43, 42, 42, 42, 42, 42]);
    let cid = block.cid().unwrap();

    commander
        .order(AllCommands::System(SystemCommand::PutKeyed {
            key: cid.to_bytes(),
            bytes: block.0.clone(),
        }))
        .await?;

    // Serve .wasm, .js and server multiaddress over HTTP on this address.
    tokio::spawn(serve(address.clone(), cid));

    loop {
        tokio::select! {
            msg = rx_net_evt.select_next_some() => {
                tracing::info!("Received msg: {:?}", msg);
                match msg {
                    Events::Outer(PublicEvent::NewConnection { peer }) => {
                       // Once connection establish, subscribe to "test" topic
                        tracing::info!("New connection from {}, subscribing to test topic", peer);

                        //command_sender
                        //    .send(AllCommands::Subscribe {
                        //        topic: "test publish".to_string(),
                        //    }.into())
                        //    .await
                        //    .expect("Failed to send subscribe command");
                        //
                        //tracing::info!("Send Bitswap request for CID: {:?}", cid);
                        //// also use Bitswap to get cid from browser, should be vec![69, 69, 69, 69, 69]
                        //let bitswap_cid = Cid::try_from("bafkr4iahcgbbgcbzj7w5uwzyp3bqjdnfd33d7wlxh5fqmnrtk3jpi2h5cm").unwrap();
                        //match commander
                        //    .order(AllCommands::System(SystemCommand::Get {
                        //        key: bitswap_cid.to_bytes(),
                        //    }))
                        //    .await {
                        //    Ok(ReturnValues::Data(data)) => {
                        //        tracing::info!("Received data from system: {:?}", data);
                        //        assert_eq!(data, vec![69, 69, 69, 69, 69]);
                        //    }
                        //    Ok(val) => {
                        //        tracing::info!("Received val from system: {:?}", val);
                        //    }
                        //    Err(err) => {
                        //        tracing::error!("Failed to get data from system: {:?}", err);
                        //    }
                        //}
                    }
                    Events::Outer(PublicEvent::Message { peer, topic, data }) => {
                        tracing::info!("Received message from {} on topic {}: {:?}", peer, topic, data);
                    }
                    Events::Outer(PublicEvent::Pong { peer, rtt }) => {
                        tracing::info!("Received pong from {} with rtt: {}", peer, rtt);
                    }
                    _ => {}
                }
            }
            _ = tokio::signal::ctrl_c() => {
                tracing::info!("Received ctrl-c");
                break;
            }
        }
    }

    Ok(())
}

#[derive(rust_embed::RustEmbed)]
#[folder = "$CARGO_MANIFEST_DIR/static"]
struct StaticFiles;

/// Serve the Multiaddr we are listening on and the host files.
pub(crate) async fn serve(libp2p_transport: Multiaddr, cid: Cid) {
    let Some(Protocol::Ip6(_listen_addr)) = libp2p_transport.iter().next() else {
        panic!("Expected 1st protocol to be IP6")
    };

    // let (results_tx, mut results_rx) = mpsc::channel(1);

    let server = Router::new()
        .route("/", get(get_index))
        .route("/index.html", get(get_index))
        .route("/:path", get(get_static_file))
        // Report tests status
        // .route("/results", post(post_results))
        .with_state(Libp2pState {
            endpoint: libp2p_transport.clone(),
            cid,
        })
        .layer(
            // allow cors
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET]),
        );

    let serve_addr_ipv4 = Ipv4Addr::new(127, 0, 0, 1);

    let addr = SocketAddr::new(serve_addr_ipv4.into(), 8080);

    tracing::info!(url=%format!("http://{addr}"), "Serving client files at url");

    tokio::spawn(async move {
        axum::Server::bind(&addr)
            .serve(server.into_make_service())
            .await
            .unwrap();
    });

    tracing::info!(url=%format!("http://{addr}"), "Opening browser");
    //
    // let (mut chrome, driver) = open_in_browser(&format!("http://{addr:?}"))
    //     .await
    //     .map_err(|e| tracing::error!(?e, "Failed to open browser"))
    //     .unwrap();
}

#[derive(Clone)]
struct Libp2pState {
    endpoint: Multiaddr,
    cid: Cid,
}

/// Serves the index.html file for our client.
///
/// Our server listens on a random UDP port for the WebRTC transport.
/// To allow the client to connect, we replace the `__LIBP2P_ENDPOINT__` placeholder with the actual address.
async fn get_index(
    State(Libp2pState {
        endpoint: libp2p_endpoint,
        cid,
    }): State<Libp2pState>,
) -> Result<Html<String>, StatusCode> {
    let content = StaticFiles::get("index.html")
        .ok_or(StatusCode::NOT_FOUND)?
        .data;

    let html = std::str::from_utf8(&content)
        .expect("index.html to be valid utf8")
        .replace("__LIBP2P_ENDPOINT__", &libp2p_endpoint.to_string())
        .replace("__BITSWAP_CID__", &cid.to_string());

    Ok(Html(html))
}

/// Serves the static files generated by `wasm-pack`.
async fn get_static_file(Path(path): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    tracing::debug!(file_path=%path, "Serving static file");

    let content = StaticFiles::get(&path).ok_or(StatusCode::NOT_FOUND)?.data;
    let content_type = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();

    Ok(([(CONTENT_TYPE, content_type)], content))
}

/// A report generated by the test
#[derive(Copy, Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Report {
    #[serde(rename = "handshakePlusOneRTTMillis")]
    handshake_plus_one_rtt_millis: f32,
    #[serde(rename = "pingRTTMilllis")]
    ping_rtt_millis: f32,
}

// #[derive(Clone)]
// struct TestState {
//     // config: config::Config,
//     results_tx: mpsc::Sender<Result<Report, String>>,
// }

// /// Receive test results
// async fn post_results(
//     mut state: State<TestState>,
//     request: Json<Result<Report, String>>,
// ) -> Result<(), StatusCode> {
//     state.0.results_tx.send(request.0).await.map_err(|_| {
//         tracing::error!("Failed to send results");
//         StatusCode::INTERNAL_SERVER_ERROR
//     })
// }

// async fn open_in_browser(addr: &str) -> Result<(Child, WebDriver)> {
//     // start a webdriver process
//     tracing::info!("Starting chromedriver");
//     // currently only the chromedriver is supported as firefox doesn't
//     // have support yet for the certhashes
//     let chromedriver = if cfg!(windows) {
//         "chromedriver.cmd"
//     } else {
//         "chromedriver"
//     };
//     let mut chrome = tokio::process::Command::new(chromedriver)
//         .arg("--port=45782")
//         .stdout(Stdio::piped())
//         .spawn()?;
//     // read driver's stdout
//     let driver_out = chrome
//         .stdout
//         .take()
//         .context("No stdout found for webdriver")?;
//     // wait for the 'ready' message
//     let mut reader = BufReader::new(driver_out).lines();
//     while let Some(line) = reader.next_line().await? {
//         if line.contains("ChromeDriver was started successfully.") {
//             break;
//         }
//     }
//
//     // run a webdriver client
//     let mut caps = DesiredCapabilities::chrome();
//     // caps.set_headless()?;
//     let driver = WebDriver::new("http://localhost:45782", caps).await?;
//     // go to the wasm test service
//     driver.goto(format!("http://{addr}")).await?;
//
//     Ok((chrome, driver))
// }

#[cfg(test)]
mod tests {
    use super::*;
    use peerpiper::core::RawBlakeBlock;

    #[test]
    fn test_cid() {
        let block = RawBlakeBlock(b"12345".into());
        let cid = block.cid().unwrap();

        assert_eq!(
            cid.to_string(),
            "bafkr4ieg6lmavpu4h55uugsxvdirgd5i3qemqfqeqm6ocijnya43aegz4q"
        );
    }

    #[test]
    fn test_cid_69() {
        let block = RawBlakeBlock(vec![69, 69, 69, 69, 69]);
        let cid = block.cid().unwrap();

        assert_eq!(
            cid.to_string(),
            "bafkr4iahcgbbgcbzj7w5uwzyp3bqjdnfd33d7wlxh5fqmnrtk3jpi2h5cm"
        );
    }
}
