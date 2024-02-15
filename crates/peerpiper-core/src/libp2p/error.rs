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
}
