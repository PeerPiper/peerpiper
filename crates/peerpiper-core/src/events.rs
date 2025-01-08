#![allow(dead_code)]
#![allow(unused_imports)]
use crate::libp2p::api::Libp2pEvent;
use libp2p::Multiaddr;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum NetworkError {
    DialFailed,
    ListenFailed,
    PublishFailed,
    SubscribeFailed,
    UnsubscribeFailed,
}

/// Peerpiper events from the network.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Network {
    Libp2p,
}

/// The Context of the event. This is essentially a serde wrapper to ensure that any JSON string is
/// formatted correctly, as WIT expects variants to be {tag: _, val: _} in lower kebab-case.
// #[derive(Debug, Serialize, Deserialize)]
// #[serde(rename_all = "kebab-case")]
// #[serde(tag = "tag", content = "val")]
// #[non_exhaustive]
// pub enum Context {
//     Event(NetworkEvent),
// }

#[derive(Debug)]
pub enum Events {
    Inner(Libp2pEvent),
    Outer(PublicEvent),
}

/// Events from the Peerpiper network.
///
/// They should be network, transport, and protocol agnostic. Could be libp2p, Nostr or HTTPS
/// publish, for example.
/// This is marked non-exhaustive because we may want to add new events in the future.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[serde(tag = "tag", content = "val")]
#[non_exhaustive]
pub enum PublicEvent {
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
    /// Data received from a peer about a topic.
    Message {
        peer: String,
        topic: String,
        data: Vec<u8>,
    },
    /// A Request was made to us, that we may or may not respond to based on screening criteria.
    Request {
        request: Vec<u8>,
        peer: String,
    },
    NewConnection {
        peer: String,
    },
    ConnectionClosed {
        peer: String,
        cause: String,
    },
}

// futures::futures_channel::mpsc::Sender<NetworkEvent>: From<futures::futures_channel::mpsc::Sender<peerpiper_core::events::Event>>

/// Command the PeerPiper network to do something for you.
///
/// They should be network, transport, and protocol agnostic. Could be libp2p, Nostr or HTTPS
/// publish, for example.
/// They should be able to be serialized and sent over the wire.
/// They should be able to be deserialized and executed by the PeerPiper network.
/// This is marked non-exhaustive because we may want to add new events in the future.
#[derive(Debug, PartialEq, Serialize, Deserialize, Clone)]
#[serde(tag = "action")]
//#[non_exhaustive]
pub enum AllCommands {
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
    /// System commands are a subset of [AllCommands] that do not go to the network, but come
    /// from componets to direct the system to do something, like save bytes to a file.
    System(SystemCommand),
    ///// Request the server to emit the Multiaddr that it is listening on
    //ShareAddress,
    /// Please peer, do something with this data and give me a response
    PeerRequest {
        /// serialized request data
        request: Vec<u8>,
        peer_id: String,
    },
    /// Puts a Record on the DHT, and optionally provides the data for Pinning
    PutRecord {
        /// The Record key bytes
        key: Vec<u8>,
        /// The Record value bytes (ie. the CID)
        value: Vec<u8>,
    },
    /// Get a Record from the DHT
    GetRecord {
        key: Vec<u8>,
    },
    /// Gets the Providers of a Record on the DHT
    GetProviders {
        key: Vec<u8>,
    },
    /// Start Providing a Record on the DHT
    StartProviding {
        key: Vec<u8>,
    },
}

/// System Commands that do not go to the network, but come from componets to direct
/// the system to do something, like save bytes to a file.
#[derive(Debug, PartialEq, Clone, Serialize, Deserialize)]
pub enum SystemCommand {
    /// Put bytes in local blockstore
    Put { bytes: Vec<u8> },
    /// Put keyed bytes in local blockstore
    PutKeyed { key: Vec<u8>, bytes: Vec<u8> },
    /// Will first try to get bytes from local blockstore, then will try network via bitswap
    Get { key: Vec<u8> },
}

pub mod test_helpers {
    use super::*;
    use crate::Commander;
    use blockstore::Blockstore;
    use cid::Cid;

    pub async fn test_all_commands<B: Blockstore + 'static>(commander: Commander<B>, cid: String) {
        commander
            .order(AllCommands::Subscribe {
                topic: "test publish".to_string(),
            })
            .await
            .expect("Failed to send subscribe command");

        let data = vec![42; 42];
        match commander
            .order(AllCommands::Publish {
                topic: "test publish".to_string(),
                data,
            })
            .await
        {
            Ok(_) => tracing::info!("Published data"),
            Err(e) => tracing::error!("Failed to publish data: {:?}", e),
        }

        tracing::info!("Sending BITSWAP / BEETSWAP system put command");
        #[allow(unused_variables)]
        let cid = Cid::try_from(cid).expect("Failed to parse CID");

        #[cfg(target_arch = "wasm32")]
        {
            wasm_bindgen_futures::spawn_local(async move {
                let res = commander
                    .order(AllCommands::System(SystemCommand::Get {
                        key: cid.to_bytes(),
                    }))
                    .await
                    .expect("Failed to send bitswap query");

                tracing::info!("bitswap response {:?}", res);
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // iterate through each PeerPiperCommand variant and print it
    #[test]
    fn test_serde_peerpiper_command() {
        let commands = vec![
            AllCommands::Publish {
                topic: "test".to_string(),
                data: vec![1, 2, 3],
            },
            AllCommands::Subscribe {
                topic: "test".to_string(),
            },
            AllCommands::Unsubscribe {
                topic: "test".to_string(),
            },
            AllCommands::System(SystemCommand::Put {
                bytes: vec![1, 2, 3],
            }),
            AllCommands::System(SystemCommand::Get {
                key: "test".to_string().into(),
            }),
            //Command::ShareAddress,
            AllCommands::PeerRequest {
                request: "what is your fave colour?".as_bytes().to_vec(),
                peer_id: "123DfQm3...".to_string(),
            },
        ];

        for command in commands {
            let serialized = serde_json::to_string(&command).unwrap();
            println!("{}", serialized);
            let deserialized: AllCommands = serde_json::from_str(&serialized).unwrap();
            assert_eq!(command, deserialized);
        }
    }
}
