pub mod error;
pub mod events;
pub mod libp2p;

pub use blockstore::block::{Block, CidError};
pub use blockstore::Blockstore;
use libp2p::api::NetworkCommand;

use crate::libp2p::api::Client;
use ::libp2p::PeerId;
pub use cid::Cid;
use events::{AllCommands, SystemCommand};
use multihash_codetable::{Code, MultihashDigest};
use std::collections::HashSet;
use std::str::FromStr;
use tokio::sync::mpsc::Sender;

const RAW_CODEC: u64 = 0x55;

/// A block that is just raw bytes encoded into a block
/// using the `RAW_CODEC` and `Blake3_256` hash function.
pub struct RawBlakeBlock(pub Vec<u8>);

impl Block<64> for RawBlakeBlock {
    fn cid(&self) -> Result<Cid, CidError> {
        let hash = Code::Blake3_256.digest(&self.0);
        Ok(Cid::new_v1(RAW_CODEC, hash))
    }

    fn data(&self) -> &[u8] {
        self.0.as_ref()
    }
}

/// A Commander is an aggregate structure that can send commands to the system and optionally to the network.
///
/// It is made by connecting the systme IO to the Network client and commander. Together, they give
/// users a unified interface to interact with the network and the system from one place.
#[derive(Debug, Clone)]
pub struct Commander<H: Blockstore> {
    swarm_sendr: Option<Sender<NetworkCommand>>,
    pub blockstore: H,
    client: Option<Client>,
}

impl<H: Blockstore> Commander<H> {
    /// Create a new Commander with the given system command handler.
    ///
    /// Optionally, you can set the network sender and client using the `with_network` and `with_client` methods.
    pub fn new(blockstore: H) -> Self {
        Self {
            swarm_sendr: None,
            client: None,
            blockstore,
        }
    }

    /// Set the network sender, the channel used to send commands to the network
    pub fn with_network(
        &mut self,
        network: tokio::sync::mpsc::Sender<libp2p::api::NetworkCommand>,
    ) -> &mut Self {
        self.swarm_sendr = Some(network);
        self
    }

    /// Set the [Client] which accesses the `api` module for the network
    pub fn with_client(&mut self, client: Client) -> &mut Self {
        self.client = Some(client);
        self
    }
}

#[derive(Debug, Clone)]
pub enum ReturnValues {
    /// The data that was put
    Data(Vec<u8>),
    /// The Cid of the data that was put
    ID(Cid),
    Providers(HashSet<PeerId>),
    None,
}

impl<H: Blockstore> Commander<H> {
    /// Sends the command using system, and optionally network if it's Some
    pub async fn order(&self, command: events::AllCommands) -> Result<ReturnValues, error::Error> {
        tracing::info!("Commander received command: {:?}", command);
        match command {
            AllCommands::System(SystemCommand::PutKeyed { key, bytes }) => {
                let cid = Cid::try_from(key).map_err(|err| {
                    error::Error::String(format!("Failed to create Cid from bytes: {}", err))
                })?;
                self.blockstore.put_keyed(&cid, &bytes).await.map_err(|e| {
                    error::Error::String(format!("Failed to put bytes in the system: {e}"))
                })?;
                Ok(ReturnValues::None)
            }
            AllCommands::System(SystemCommand::Put { bytes }) => {
                let block = RawBlakeBlock(bytes.clone());
                let cid = block.cid().unwrap();
                self.blockstore.put(block).await.map_err(|err| {
                    error::Error::String(format!("Failed to put bytes in the system: {}", err))
                })?;

                Ok(ReturnValues::ID(cid))
            }
            AllCommands::System(SystemCommand::Get { key }) => {
                tracing::info!("Commander received Get command: {:?}", key);
                let cid = Cid::try_from(key.clone()).map_err(|err| {
                    error::Error::String(format!("Failed to create Cid from bytes: {}", err))
                })?;
                tracing::info!("Commander created Cid: {:?}", cid);
                let bytes = match self.blockstore.get(&cid).await {
                    Ok(Some(bytes)) => {
                        tracing::info!("Got bytes from the local blockstore: {:?}", bytes.len());
                        bytes
                    }
                    Ok(None) => {
                        tracing::info!("No bytes in the local blockstore, try Bitswap.");
                        // try the network,if available
                        match &self.client {
                            Some(client) => {
                                let res = client.get_bits(key).await?;
                                tracing::info!("Got bytes from bitswap: {:?}", res.len());
                                res
                            }
                            None => {
                                return Err(error::Error::String(
                                    "Tried to get bytes from bitswap and the system, but failed to resolve from either."
                                        .to_string(),
                                ));
                            }
                        }
                    }
                    Err(err) => {
                        return Err(error::Error::String(format!(
                            "Failed to get bytes from the system: {}",
                            err
                        )));
                    }
                };
                Ok(ReturnValues::Data(bytes))
            }
            AllCommands::PeerRequest { request, peer_id } => match &self.client {
                Some(client) => {
                    let peer_id = PeerId::from_str(&peer_id).map_err(|err| {
                        error::Error::String(format!("Failed to create PeerId: {}", err))
                    })?;
                    let response = match client.request_response(request, peer_id).await {
                        Ok(response) => response,
                        Err(err) => {
                            return Err(error::Error::String(format!(
                                "Failed to send request: {}",
                                err
                            )));
                        }
                    };
                    Ok(ReturnValues::Data(response))
                }
                None => Err(error::Error::String(
                    "Tried to send a network command, but network nor client is not initialized"
                        .to_string(),
                )),
            },
            AllCommands::GetProviders { key } => match &self.client {
                Some(client) => {
                    let providers = client.get_providers(key).await?;
                    Ok(ReturnValues::Providers(providers))
                }
                None => Err(error::Error::String(
                    "Tried to send a network command, but network is not initialized".to_string(),
                )),
            },
            AllCommands::GetRecord { key } => match &self.client {
                Some(client) => {
                    let bytes = client.get_record(key).await?;
                    Ok(ReturnValues::Data(bytes))
                }
                None => Err(error::Error::String(
                    "Tried to send a network command, but network is not initialized".to_string(),
                )),
            },
            // The follow commands get sent over the network and do not expect a direct response
            AllCommands::Publish { .. }
            | AllCommands::Subscribe { .. }
            | AllCommands::Unsubscribe { .. }
            | AllCommands::PutRecord { .. }
            | AllCommands::StartProviding { .. } => {
                match &self.swarm_sendr {
                    Some(swarm_sendr) => swarm_sendr.send(command.into()).await?,
                    None => {
                        return Err(error::Error::String(
                            "Tried to send a network command, but network is not initialized"
                                .to_string(),
                        ));
                    }
                }
                Ok(ReturnValues::None)
            }
        }
    }
}

// From events::Command for libp2p::api::Command
impl From<AllCommands> for libp2p::api::NetworkCommand {
    fn from(command: AllCommands) -> Self {
        match command {
            AllCommands::Publish { topic, data } => {
                libp2p::api::NetworkCommand::Publish { topic, data }
            }
            AllCommands::Subscribe { topic } => libp2p::api::NetworkCommand::Subscribe { topic },
            AllCommands::Unsubscribe { topic } => {
                libp2p::api::NetworkCommand::Unsubscribe { topic }
            }
            AllCommands::PutRecord { key, value } => {
                libp2p::api::NetworkCommand::PutRecord { key, value }
            }
            AllCommands::StartProviding { key } => {
                libp2p::api::NetworkCommand::StartProviding { key }
            }

            // This should only be used in one place: swarm_sendr, so it's safe to panic?
            _ => unreachable!(),
        }
    }
}

#[cfg(test)]
mod test {
    use libp2p::PeerId;
    use std::str::FromStr;

    #[test]
    fn test_decode_peer_id() {
        let peer_id = PeerId::from_str("12D3KooWMZpk755dsWe8yiefX93rQgpqUegcjoFEZMKRKUMc7Sab");
        assert!(peer_id.is_ok());
    }
}
