#![feature(ip)]
pub mod error;
pub mod events;
pub mod libp2p;

use events::{PeerPiperCommand, SystemCommand};
use futures::channel::mpsc;
use futures::SinkExt;
use wnfs_common::libipld::Cid;
use wnfs_common::utils::CondSend;

pub struct Commander<H: SystemCommandHandler> {
    network: Option<mpsc::Sender<PeerPiperCommand>>,
    system_command_handler: H,
}

impl<H: SystemCommandHandler> Commander<H> {
    pub fn new(system_command_handler: H) -> Self {
        Self {
            network: None,
            system_command_handler,
        }
    }

    pub fn with_network(&mut self, network: mpsc::Sender<PeerPiperCommand>) {
        self.network = Some(network);
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
                    error::Error::String(format!(
                        "Failed to put bytes in the system: {}",
                        e.to_string()
                    ))
                })?;
                Ok(ReturnValues::ID(cid))
            }
            PeerPiperCommand::System(SystemCommand::Get { key }) => {
                let bytes = self.system_command_handler.get(key).await.map_err(|e| {
                    error::Error::String(format!(
                        "Failed to get bytes from the system: {}",
                        e.to_string()
                    ))
                })?;
                Ok(ReturnValues::Data(bytes))
            }
            _ => {
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
