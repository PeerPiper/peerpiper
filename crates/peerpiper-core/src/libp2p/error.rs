#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// from ConfigBuilderError
    #[error("ConfigBuilderError: {0}")]
    ConfigBuilderError(#[from] libp2p::gossipsub::ConfigBuilderError),

    /// from &'static str
    #[error("{0}")]
    StaticStr(&'static str),

    /// from String
    #[error("{0}")]
    String(String),

    #[error("{0}")]
    GossipSubMessageAuthenticity(&'static str),

    /// From oneshot canceled error  
    #[error("Oneshot canceled")]
    OneshotCanceled(#[from] futures::channel::oneshot::Canceled),

    /// From OutboundFailure
    #[error("OutboundFailure: {0}")]
    OutboundFailure(#[from] libp2p::request_response::OutboundFailure),

    /// From [futures::futures_channel::mpsc::SendError]
    #[error("SendError: {0}")]
    SendError(#[from] futures::channel::mpsc::SendError),
    /// From TransportError
    #[error("TransportError: {0}")]
    TransportIo(#[from] libp2p::core::transport::TransportError<std::io::Error>),

    /// Dial Error
    #[error("DialError: {0}")]
    DialError(#[from] libp2p::swarm::DialError),

    /// From<tokio::sync::mpsc::error::SendError<libp2p::api::NetworkCommand>>
    #[error("SendError: {0}")]
    NetworkCommandSendError(
        #[from] tokio::sync::mpsc::error::SendError<super::api::NetworkCommand>,
    ),
}
