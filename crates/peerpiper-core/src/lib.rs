#![feature(ip)]
pub mod error;
pub mod events;
pub mod libp2p;

use crate::libp2p::api::Client;
use ::libp2p::PeerId;
use events::{PeerPiperCommand, SystemCommand};
use futures::channel::mpsc;
use futures::SinkExt;
use std::str::FromStr;
use wnfs_common::libipld::Cid;
use wnfs_common::utils::CondSend;

pub struct Commander<H: SystemCommandHandler> {
    network: Option<mpsc::Sender<PeerPiperCommand>>,
    system_command_handler: H,
    client: Option<Client>,
}

impl<H: SystemCommandHandler> Commander<H> {
    pub fn new(system_command_handler: H) -> Self {
        Self {
            network: None,
            client: None,
            system_command_handler,
        }
    }

    /// Set the network sender, the channel used to send commands to the network
    pub fn with_network(&mut self, network: mpsc::Sender<PeerPiperCommand>) -> &mut Self {
        self.network = Some(network);
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
    None,
}

impl<H: SystemCommandHandler> Commander<H> {
    /// Sends the command using system, and optionally network if it's Some
    pub async fn order(&mut self, command: PeerPiperCommand) -> Result<ReturnValues, error::Error> {
        match command {
            PeerPiperCommand::System(SystemCommand::Put { bytes }) => {
                let cid = self.system_command_handler.put(bytes).await.map_err(|e| {
                    error::Error::String(format!("Failed to put bytes in the system: {e}"))
                })?;
                Ok(ReturnValues::ID(cid))
            }
            PeerPiperCommand::System(SystemCommand::Get { key }) => {
                let bytes = self.system_command_handler.get(key).await.map_err(|e| {
                    error::Error::String(format!("Failed to get bytes from the system: {e}"))
                })?;
                Ok(ReturnValues::Data(bytes))
            }
            PeerPiperCommand::PeerRequest { request, peer_id } => match &mut self.client {
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
            // The follow commands get sent over the network and do not expect a direct response
            PeerPiperCommand::Publish { .. }
            | PeerPiperCommand::Subscribe { .. }
            | PeerPiperCommand::Unsubscribe { .. }
            | PeerPiperCommand::ShareAddress { .. }
            | PeerPiperCommand::PutRecord { .. } => {
                match &mut self.network {
                    Some(network) => network.send(command).await?,
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

/// System specific implementation must have a put and get command to save and retrieve data.
pub trait SystemCommandHandler {
    type Error: std::error::Error;
    fn put(
        &self,
        bytes: Vec<u8>,
    ) -> impl std::future::Future<Output = Result<Cid, Self::Error>> + CondSend;
    fn get(
        &self,
        key: String,
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
