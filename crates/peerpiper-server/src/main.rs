#![feature(async_closure)]
#![allow(clippy::needless_return)]

#[cfg(feature = "cloudflare")]
mod cloudflare;

/// Extend the functionality of the peerpiper-server with custom handlers
#[cfg(feature = "extensions")]
mod extensions;

use anyhow::Result;
use axum::extract::State;
use axum::response::{Html, IntoResponse};
use axum::Router;
use axum::{http::Method, routing::get};
use futures::channel::{mpsc, oneshot};
use futures::StreamExt;
use libp2p::multiaddr::{Multiaddr, Protocol};
use peerpiper::core::events::{Events, PublicEvent};
use peerpiper::core::libp2p::api::Libp2pEvent;
use std::net::{Ipv4Addr, SocketAddr};
use tower_http::cors::{Any, CorsLayer};

const MAX_CHANNELS: usize = 16;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            "info,interop_tests_native=debug,peerpiper_native=debug,libp2p_webrtc=off,libp2p_ping=debug,libp2p_gossipsub=info",
        )
        .try_init();

    tracing::info!("Starting peerpiper-server");

    let (tx, mut rx) = mpsc::channel(MAX_CHANNELS);
    let (_command_sender, command_receiver) = mpsc::channel(8);
    let tx_clone = tx.clone();
    let (tx_client, _rx_client) = oneshot::channel();

    tokio::spawn(async move {
        peerpiper::start(tx_clone, command_receiver, tx_client)
            .await
            .unwrap();
    });

    tracing::info!("Started.");

    let address = loop {
        if let Events::Outer(PublicEvent::ListenAddr { address, .. }) = rx.next().await.unwrap() {
            tracing::info!(%address, "RXD Address");
            break address;
        }
    };

    // Serve .wasm, .js and server multiaddress over HTTP on this address.
    tokio::spawn(serve(address.clone()));

    let handle_new_address = async |address: &Multiaddr| {
        #[cfg(feature = "cloudflare")]
        if let Err(e) = cloudflare::add_address(address).await {
            tracing::error!("Could not add address to cloudflare DNS record: {e}");
        }
    };

    handle_new_address(&address).await;

    // TODO: Insert handler (WIT components) here.
    // let bytes = peerpiper::handler::utils::get_wasm_bytes("peerpiper_handler")?;
    // let handler = peerpiper::handler::Handler::new(bytes)?;

    // create new Extensions struct with a given wasm file
    // for now, use ../../../target/wasm32-wasip1/debug/extension_echo.wasm
    let path = std::env::current_dir()?;
    //let extensions = extensions::Extensions::new("peerpiper_handler")?;

    loop {
        tokio::select! {
            Some(msg) = rx.next() => {
                match msg {
                    Events::Outer(ref m @ PublicEvent::Message { ref topic, ref peer, ref data }) => {
                        tracing::info!("Received msg on topic {:?} from peer: {:?}, {:?}", topic, peer, data);
                        //let res = extensions.handle_message(extensions::Message { topic: topic.clone(), peer: peer.clone(), data: data.clone() });
                        // let r = handler.handle(m.clone()).await?;
                        // tracing::info!("Handler returned: {:?}", r);
                    }
                    Events::Inner(Libp2pEvent::InboundRequest {request, channel }) => {
                        tracing::info!("InboundRequest: {:?}", request);
                        // iterate over extensions and allows them to handle fulfilling the
                        // request, if applicable to them.
                    }
                    Events::Outer(PublicEvent::ListenAddr { address: _, .. }) => {
                        // TODO: Figure out what we want to do with the other new addresses.
                        //handle_new_address(&address).await;
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
    let Some(Protocol::Ip6(_listen_addr)) = libp2p_transport.iter().next() else {
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
        if let Err(e) = axum::Server::bind(&addr)
            .serve(server.into_make_service())
            .await
        {
            tracing::error!(%e, "Error serving client files");
        }
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
