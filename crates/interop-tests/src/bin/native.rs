use anyhow::Result;
use axum::extract::{Path, State};
use axum::http::header::CONTENT_TYPE;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse};
// use axum::routing::post;
use axum::{http::Method, routing::get};
// use axum::{Json};
use axum::Router;
use futures::channel::mpsc;
use futures::{SinkExt, StreamExt};
use libp2p::multiaddr::{Multiaddr, Protocol};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

// use std::process::Stdio;
// use thirtyfour::prelude::*;
// use tokio::io::{AsyncBufReadExt, BufReader};
// use tokio::process::Child;

use peerpiper::core::events::{NetworkEvent, PeerPiperCommand};

const MAX_CHANNELS: usize = 16;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "interop_tests_native=debug,peerpiper_native=debug,peerpiper_core=debug,libp2p_webrtc=info,libp2p_ping=debug",
        )
        .try_init();

    tracing::info!("Starting peerpiper-native TESTS");

    let (tx_net_evt, mut rx_net_evt) = mpsc::channel(MAX_CHANNELS);
    let (mut command_sender, command_receiver) = mpsc::channel(8);
    let tx_net_evt_clone = tx_net_evt.clone();

    tokio::spawn(async move {
        peerpiper::start(tx_net_evt_clone, command_receiver)
            .await
            .unwrap();
    });

    tracing::info!("Started.");

    let address = loop {
        if let NetworkEvent::ListenAddr { address, .. } = rx_net_evt.next().await.unwrap() {
            tracing::info!(%address, "RXD Address");
            break address;
        }
    };

    // Serve .wasm, .js and server multiaddress over HTTP on this address.
    tokio::spawn(serve(address.clone()));

    loop {
        tokio::select! {
            Some(msg) = rx_net_evt.next() => {
                tracing::info!("Received msg: {:?}", msg);
                match msg {
                    NetworkEvent::NewConnection { peer } => {
                       // Once connection establish, subscribe to "test" topic
                        tracing::info!("New connection from {}, subscribing to test topic", peer);
                        command_sender
                            .send(PeerPiperCommand::Subscribe {
                                topic: "test publish".to_string(),
                            })
                            .await
                            .expect("Failed to send subscribe command");
                    }
                    NetworkEvent::Message { peer, topic, data } => {
                        tracing::info!("Received message from {} on topic {}: {:?}", peer, topic, data);
                    }
                    NetworkEvent::Pong { peer, rtt } => {
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
pub(crate) async fn serve(libp2p_transport: Multiaddr) {
    let Some(Protocol::Ip4(listen_addr)) = libp2p_transport.iter().next() else {
        panic!("Expected 1st protocol to be IP4")
    };

    // let (results_tx, mut results_rx) = mpsc::channel(1);

    let server = Router::new()
        .route("/", get(get_index))
        .route("/index.html", get(get_index))
        .route("/:path", get(get_static_file))
        // Report tests status
        // .route("/results", post(post_results))
        .with_state(Libp2pEndpoint(libp2p_transport))
        .layer(
            // allow cors
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET]),
        );

    let addr = SocketAddr::new(listen_addr.into(), 8080);

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
struct Libp2pEndpoint(Multiaddr);

/// Serves the index.html file for our client.
///
/// Our server listens on a random UDP port for the WebRTC transport.
/// To allow the client to connect, we replace the `__LIBP2P_ENDPOINT__` placeholder with the actual address.
async fn get_index(
    State(Libp2pEndpoint(libp2p_endpoint)): State<Libp2pEndpoint>,
) -> Result<Html<String>, StatusCode> {
    let content = StaticFiles::get("index.html")
        .ok_or(StatusCode::NOT_FOUND)?
        .data;

    let html = std::str::from_utf8(&content)
        .expect("index.html to be valid utf8")
        .replace("__LIBP2P_ENDPOINT__", &libp2p_endpoint.to_string());

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
