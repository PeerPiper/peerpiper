use axum::extract::State;
use axum::response::{Html, IntoResponse};
use axum::Router;
use axum::{http::Method, routing::get};
use libp2p::Multiaddr;
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use tower_http::cors::{Any, CorsLayer};

/// Serve the Multiaddr we are listening on and the host files.
pub(crate) async fn serve(libp2p_transport: Multiaddr) {
    // let Some(Protocol::Ip6(_listen_addr)) = libp2p_transport.iter().next() else {
    //     panic!("Expected 1st protocol to be IP6")
    // };

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
