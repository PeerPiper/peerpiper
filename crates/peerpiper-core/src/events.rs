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
    Connected,
}

// futures::futures_channel::mpsc::Sender<NetworkEvent>: From<futures::futures_channel::mpsc::Sender<peerpiper_core::events::Event>>

/// Command the PeerPiper network to do something for you.
///
/// They should be network, transport, and protocol agnostic. Could be libp2p, Nostr or HTTPS
/// publish, for example.
/// They should be able to be serialized and sent over the wire.
/// They should be able to be deserialized and executed by the PeerPiper network.
/// This is marked non-exhaustive because we may want to add new events in the future.
#[derive(Debug, PartialEq, Serialize, Deserialize, Clone, Hash)]
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
    /// Open a new stream with this peer on the given protocol
    OpenStream {
        peer_id: String,
        protocol: String,
    },
    /// Dial this multiaddr
    Dial(Multiaddr),
}

/// Returns the u64 request id for this AllCommands
impl AllCommands {
    /// The u64 hash of this command, used as a request id
    pub fn request_id(&self) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        hasher.finish()
    }
}

/// System Commands that do not go to the network, but come from componets to direct
/// the system to do something, like save bytes to a file.
#[derive(Debug, PartialEq, Clone, Serialize, Deserialize, Hash)]
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
    use crate::{Commander, ReturnValues};
    use blockstore::Blockstore;
    use cid::Cid;
    use libp2p::PeerId;

    pub async fn test_all_commands<B: Blockstore + Clone + 'static>(
        commander: Commander<B>,
        cid: String,
        remote: PeerId,
    ) {
        tracing::info!("TEST ALL COMMANDS Sending subscribe command");
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
            let commander_clone = commander.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let res = commander_clone
                    .order(AllCommands::System(SystemCommand::Get {
                        key: cid.to_bytes(),
                    }))
                    .await
                    .expect("Failed to send bitswap query");

                tracing::info!("bitswap response {:?}", res);
            });
        }

        // Request a Response from a peer, expect echo.
        let request = b"echo".to_vec();
        let peer_id = remote.to_string();
        match commander
            .order(AllCommands::PeerRequest {
                request: request.clone(),
                peer_id,
            })
            .await
        {
            Ok(ReturnValues::Data(response)) => {
                tracing::info!("PeerRequest response: {:?}", response);
                assert_eq!(response, request);
            }
            _ => panic!("Failed to request peer response"),
        }

        // Open a stream witht he remote
        match commander
            .order(AllCommands::OpenStream {
                peer_id: remote.to_string(),
                protocol: "/echo/1.0.0".to_string(),
            })
            .await
        {
            Ok(ReturnValues::None) => {
                tracing::info!("Sent open stream request");
            }
            _ => panic!("Failed to request open stream"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // iterate through each PeerPiperCommand variant and print it
    #[test]
    fn test_serde_peerpiper_command() {
        //let commands = vec![
        //    AllCommands::Publish {
        //        topic: "test".to_string(),
        //        data: vec![1, 2, 3],
        //    },
        //    AllCommands::Subscribe {
        //        topic: "test".to_string(),
        //    },
        //    AllCommands::Unsubscribe {
        //        topic: "test".to_string(),
        //    },
        //    AllCommands::System(SystemCommand::Put {
        //        bytes: vec![1, 2, 3],
        //    }),
        //    AllCommands::System(SystemCommand::Get {
        //        key: "test".to_string().into(),
        //    }),
        //    //Command::ShareAddress,
        //    AllCommands::PeerRequest {
        //        request: "what is your fave colour?".as_bytes().to_vec(),
        //        peer_id: "123DfQm3...".to_string(),
        //    },
        //];
        //
        //for command in commands {
        //    let serialized = serde_json::to_string(&command).unwrap();
        //    println!("{}", serialized);
        //    let deserialized: AllCommands = serde_json::from_str(&serialized).unwrap();
        //    assert_eq!(command, deserialized);
        //}
    }
}
