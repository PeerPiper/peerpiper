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
use futures::StreamExt;
use libp2p::multiaddr::{Multiaddr, Protocol};
use std::net::{Ipv4Addr, SocketAddr};
use tower_http::cors::{Any, CorsLayer};

// use std::process::Stdio;
// use thirtyfour::prelude::*;
// use tokio::io::{AsyncBufReadExt, BufReader};
// use tokio::process::Child;

use peerpiper::core::events::NetworkEvent;

const MAX_CHANNELS: usize = 16;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "info,interop_tests_native=debug,peerpiper_native=debug,libp2p_webrtc=off,libp2p_ping=info,libp2p_gossipsub=debug",
        )
        .try_init();

    tracing::info!("Starting peerpiper-native TESTS");

    let (tx, mut rx) = mpsc::channel(MAX_CHANNELS);
    let (mut command_sender, command_receiver) = mpsc::channel(8);
    let tx_clone = tx.clone();

    tokio::spawn(async move {
        peerpiper::start(tx_clone, command_receiver).await.unwrap();
    });

    tracing::info!("Started.");

    let address = loop {
        if let NetworkEvent::ListenAddr { address, .. } = rx.next().await.unwrap() {
            tracing::info!(%address, "RXD Address");
            break address;
        }
    };

    // Serve .wasm, .js and server multiaddress over HTTP on this address.
    tokio::spawn(serve(address.clone()));

    loop {
        tokio::select! {
            Some(msg) = rx.next() => {
                match msg {
                    NetworkEvent::Message { topic, peer, .. } => {
                        tracing::info!("Received msg on topic {:?} from peer: {:?}", topic, peer);
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

/// Serve the Multiaddr we are listening on and the host files.
pub(crate) async fn serve(libp2p_transport: Multiaddr) {
    let Some(Protocol::Ip6(listen_addr)) = libp2p_transport.iter().next() else {
        panic!("Expected 1st protocol to be IP6")
    };

    // Serve the addr as a string over HTTP.
    let server = Router::new()
        .route("/", get(get_index))
        .route("/index.html", get(get_index))
        .with_state(Libp2pEndpoint(libp2p_transport))
        .layer(
            // allow cors
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET]),
        );

    // let addr = SocketAddr::new(listen_addr.into(), 8080);
    let addr = SocketAddr::new(std::net::IpAddr::V4(Ipv4Addr::LOCALHOST), 8080);

    tracing::info!(url=%format!("http://{addr}"), "Serving client files at url");

    tokio::spawn(async move {
        axum::Server::bind(&addr)
            .serve(server.into_make_service())
            .await
            .unwrap();
    });

    tracing::info!(url=%format!("http://{addr}"), "Opening browser");
}

#[derive(Clone)]
struct Libp2pEndpoint(Multiaddr);

/// Serves the libp2p_endpoint as plain text (no HTML) at '/' and  'index.html'
async fn get_index(
    State(Libp2pEndpoint(libp2p_endpoint)): State<Libp2pEndpoint>,
) -> impl IntoResponse {
    tracing::info!(%libp2p_endpoint, "Serving libp2p_endpoint");
    Html(libp2p_endpoint.to_string())
}
