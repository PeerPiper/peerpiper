use libp2p::Multiaddr;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum NetworkError {
    DialFailed,
    ListenFailed,
    PublishFailed,
    SubscribeFailed,
    UnsubscribeFailed,
}

/// Peerpiper events from the network.
#[derive(Debug, Serialize, Deserialize)]
pub enum Network {
    Libp2p,
}

/// The Context of the event. This is essentially a serde wrapper to ensure that any JSON string is
/// formatted correctly, as WIT expects variants to be {tag: _, val: _} in lower kebab-case.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[serde(tag = "tag", content = "val")]
#[non_exhaustive]
pub enum Context {
    Event(NetworkEvent),
}

/// Events from the Peerpiper network.
/// They should be network, transport, and protocol agnostic. Could be libp2p, Nostr or HTTPS
/// publish, for example.
/// This is marked non-exhaustive because we may want to add new events in the future.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[serde(tag = "tag", content = "val")]
#[non_exhaustive]
pub enum NetworkEvent {
    ListenAddr {
        address: Multiaddr,
        network: Network,
    },
    Error {
        error: NetworkError,
    },
    Pong {
        peer: String,
        rtt: u64,
    },
    Message {
        peer: String,
        topic: String,
        data: Vec<u8>,
    },
    NewConnection {
        peer: String,
    },
}

/// Command Events to the PeerPiper network.
/// They should be network, transport, and protocol agnostic. Could be libp2p, Nostr or HTTPS
/// publish, for example.
/// They should be able to be serialized and sent over the wire.
/// They should be able to be deserialized and executed by the PeerPiper network.
/// This is marked non-exhaustive because we may want to add new events in the future.
#[derive(Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum PeerPiperCommand {
    Publish {
        topic: String,
        data: Vec<u8>,
    },
    Subscribe {
        topic: String,
    },
    Unsubscribe {
        topic: String,
    },
    /// System commands are a subset of PeerPiperCommands that do not go to the network, but come
    /// from componets to direct the system to do something, like save bytes to a file.
    System(SystemCommand),
}

/// System Commands that do not fo to the network, but come from componets to direct
/// the system to do something, like save bytes to a file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SystemCommand {
    Put { bytes: Vec<u8> },
    Get { key: String },
}

pub mod test_helpers {
    use super::PeerPiperCommand;
    use futures::channel::mpsc;
    use futures::SinkExt;

    pub async fn test_all_commands(command_sender: &mut mpsc::Sender<PeerPiperCommand>) {
        command_sender
            .send(PeerPiperCommand::Subscribe {
                topic: "test publish".to_string(),
            })
            .await
            .expect("Failed to send subscribe command");

        // tracing::info!("Sending unsubscribe command");
        // command_sender
        //     .send(PeerPiperCommand::Unsubscribe {
        //         topic: "test".to_string(),
        //     })
        //     .await
        //     .expect("Failed to send unsubscribe command");

        let data = vec![42; 690];
        match command_sender
            .send(PeerPiperCommand::Publish {
                topic: "test publish".to_string(),
                data,
            })
            .await
        {
            Ok(_) => tracing::info!("Published data"),
            Err(e) => tracing::error!("Failed to publish data: {:?}", e),
        }
    }
}
