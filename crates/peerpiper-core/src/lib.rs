pub mod error;
pub mod events;
pub mod libp2p;

// re-export Blockstore
pub use wnfs_common::{blockstore::BlockStore, libipld::Cid, BlockStoreError};

use crate::libp2p::api::Client;
use ::libp2p::PeerId;
use events::{AllCommands, SystemCommand};
use futures::channel::mpsc;
use futures::SinkExt;
use std::collections::HashSet;
use std::str::FromStr;
pub use wnfs_common;
use wnfs_common::utils::CondSend;

/// A Commander is an aggregate structure that can send commands to the system and optionally to the network.
///
/// It is made by connecting the systme IO to the Network client and commander. Together, they give
/// users a unified interface to interact with the network and the system from one place.
#[derive(Debug, Clone)]
pub struct Commander<H: SystemCommandHandler> {
    swarm_sendr: Option<mpsc::Sender<libp2p::api::NetworkCommand>>,
    system_command_handler: H,
    client: Option<Client>,
}

impl<H: SystemCommandHandler> Commander<H> {
    /// Create a new Commander with the given system command handler.
    ///
    /// Optionally, you can set the network sender and client using the `with_network` and `with_client` methods.
    pub fn new(system_command_handler: H) -> Self {
        Self {
            swarm_sendr: None,
            client: None,
            system_command_handler,
        }
    }

    /// Set the network sender, the channel used to send commands to the network
    pub fn with_network(
        &mut self,
        network: mpsc::Sender<libp2p::api::NetworkCommand>,
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

pub enum ReturnValues {
    Data(Vec<u8>),
    ID(Cid),
    Providers(HashSet<PeerId>),
    None,
}

impl<H: SystemCommandHandler> Commander<H> {
    /// Sends the command using system, and optionally network if it's Some
    pub async fn order(
        &mut self,
        command: events::AllCommands,
    ) -> Result<ReturnValues, error::Error> {
        match command {
            AllCommands::System(SystemCommand::Put { bytes }) => {
                let cid = self.system_command_handler.put(bytes).await.map_err(|e| {
                    error::Error::String(format!("Failed to put bytes in the system: {e}"))
                })?;
                Ok(ReturnValues::ID(cid))
            }
            AllCommands::System(SystemCommand::Get { key }) => {
                let bytes = self.system_command_handler.get(key).await.map_err(|e| {
                    error::Error::String(format!("Failed to get bytes from the system: {e}"))
                })?;
                Ok(ReturnValues::Data(bytes))
            }
            AllCommands::PeerRequest { request, peer_id } => match &mut self.client {
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
            AllCommands::GetProviders { key } => match &mut self.client {
                Some(client) => {
                    let providers = client.get_providers(key).await?;
                    Ok(ReturnValues::Providers(providers))
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
                match &mut self.swarm_sendr {
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

/// System specific implementation must have a put and get command to save and retrieve data.
pub trait SystemCommandHandler {
    type Error: std::error::Error;

    /// Save the bytes to the system, return the Cid
    fn put(
        &self,
        bytes: Vec<u8>,
    ) -> impl std::future::Future<Output = Result<Cid, Self::Error>> + CondSend;

    /// Get the bytes from the system using Cid bytes
    fn get(
        &self,
        key: Vec<u8>,
    ) -> impl std::future::Future<Output = Result<Vec<u8>, Self::Error>> + CondSend;
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
