use crate::events::{Network, NetworkEvent};
use crate::libp2p::behaviour::{Behaviour, BehaviourEvent};
use futures::StreamExt;
use futures::{
    channel::{
        mpsc::{self, Receiver},
        oneshot,
    },
    SinkExt,
};
use libp2p::core::transport::ListenerId;
use libp2p::core::ConnectedPoint;
use libp2p::multiaddr::Protocol;
use libp2p::swarm::{Swarm, SwarmEvent};
use libp2p::{ping, Multiaddr};
use std::error::Error;
use std::net::Ipv4Addr;
use std::time::Duration;

use super::delay;

const TICK_INTERVAL: Duration = Duration::from_secs(15);

/// Create new API to interact with the network:
///
/// - Network Client: Interact with the netowrk by sending
/// - Network Event Loop: Start the network event loop
pub async fn new(swarm: Swarm<Behaviour>) -> (Client, Receiver<NetworkEvent>, EventLoop) {
    let (command_sender, command_receiver) = mpsc::channel(8);
    let (event_sender, event_receiver) = mpsc::channel(8);

    (
        Client {
            sender: command_sender,
        },
        event_receiver,
        EventLoop::new(swarm, command_receiver, event_sender),
    )
}

#[derive(Clone)]
pub struct Client {
    sender: mpsc::Sender<Command>,
}

impl Client {
    /// Listen for incoming connections on the given address.
    pub async fn start_listening(
        &mut self,
        addr: Multiaddr,
    ) -> Result<ListenerId, Box<dyn Error + Send>> {
        let (sender, receiver) = oneshot::channel();
        self.sender
            .send(Command::StartListening { addr, sender })
            .await
            .expect("Command receiver not to be dropped.");
        receiver.await.expect("Sender not to be dropped.")
    }
    // Dial
    pub async fn dial(&mut self, addr: Multiaddr) -> Result<(), Box<dyn Error + Send>> {
        let (sender, receiver) = oneshot::channel();
        self.sender
            .send(Command::Dial { addr, sender })
            .await
            .expect("Command receiver not to be dropped.");
        receiver.await.expect("Sender not to be dropped.")
    }
    pub async fn publish(&mut self, message: String, topic: String) {
        self.sender
            .send(Command::Publish { message, topic })
            .await
            .expect("Command receiver not to be dropped.");
    }
    pub async fn subscribe(&mut self, topic: String) {
        self.sender
            .send(Command::Subscribe { topic })
            .await
            .expect("Command receiver not to be dropped.");
    }
}

#[derive(Debug)]
enum Command {
    StartListening {
        addr: Multiaddr,
        sender: oneshot::Sender<Result<ListenerId, Box<dyn Error + Send>>>,
    },
    Dial {
        addr: Multiaddr,
        sender: oneshot::Sender<Result<(), Box<dyn Error + Send>>>,
    },
    Publish {
        message: String,
        topic: String,
    },
    Subscribe {
        topic: String,
    },
}

/// The network event loop.
/// Handles all the network logic for us.
pub struct EventLoop {
    /// A future that fires at a regular interval and drives the behaviour of the network.
    tick: delay::Delay,
    /// The libp2p Swarm that handles all the network logic for us.
    swarm: Swarm<Behaviour>,
    /// Channel to send commands to the network event loop.
    command_receiver: mpsc::Receiver<Command>,
    /// Channel to send events from the network event loop to the user.
    event_sender: mpsc::Sender<NetworkEvent>,
}

impl EventLoop {
    /// Creates a new network event loop.
    fn new(
        swarm: Swarm<Behaviour>,
        command_receiver: mpsc::Receiver<Command>,
        event_sender: mpsc::Sender<NetworkEvent>,
    ) -> Self {
        Self {
            tick: delay::Delay::new(TICK_INTERVAL),
            swarm,
            command_receiver,
            event_sender,
        }
    }

    /// Runs the network event loop.
    pub async fn run(mut self) {
        loop {
            futures::select! {
                event = self.swarm.next() => self.handle_event(event.expect("Swarm stream to be infinite.")).await,
                command = self.command_receiver.next() => match command {
                    Some(c) => self.handle_command(c).await,
                    // Command channel closed, thus shutting down the network event loop.
                    None => return,
                },
                _ = &mut self.tick => self.handle_tick().await,
            }
        }
    }

    /// Handles a tick of the `tick` future.
    async fn handle_tick(&mut self) {
        tracing::info!("🕒 Tick");
        self.tick.reset(TICK_INTERVAL);

        // if let Some(Err(e)) = self
        //     .swarm
        //     .behaviour_mut()
        //     .kademlia
        //     .as_mut()
        //     .map(|k| k.bootstrap())
        // {
        //     tracing::debug!("Failed to run Kademlia bootstrap: {e:?}");
        // }

        let _message = format!("Hello world! Sent from the rust-peer");

        // if let Some(Err(err)) = self
        //     .swarm
        //     .behaviour_mut()
        //     .gossipsub
        //     .as_mut()
        //     .map(|g| g.publish(topic::topic(), message.as_bytes()))
        // {
        //     error!("Failed to publish periodic message: {err}")
        // }
    }

    /// Handles a network event according to the matched Event type
    async fn handle_event(&mut self, event: SwarmEvent<BehaviourEvent>) {
        match event {
            SwarmEvent::NewListenAddr { address, .. } => {
                let mut addr_handler = || {
                    let p2p_addr = address
                        .clone()
                        .with(Protocol::P2p(*self.swarm.local_peer_id()));

                    // info!("Listen p2p address: \n\x1b[30;1;42m{p2p_addr}\x1b[0m");
                    // This address is reachable, add it
                    self.swarm.add_external_address(p2p_addr.clone());

                    // pass the address back to the other task, for display, etc.
                    self.event_sender.try_send(NetworkEvent::ListenAddr {
                        address: p2p_addr.clone(),
                        network: Network::Libp2p,
                    })
                };
                // Protocol::Ip is the first item in the address vector
                match address.iter().next().unwrap() {
                    Protocol::Ip6(ip6) => {
                        // Only add our globally available IPv6 addresses to the external addresses list.
                        if !ip6.is_loopback() && !ip6.is_unspecified() {
                            if let Err(e) = addr_handler() {
                                tracing::error!("Failed to send listen address: {:?}", e);
                            }
                        }
                    }
                    Protocol::Ip4(ip4) => {
                        if !ip4.is_loopback() && !ip4.is_unspecified() && ip4 != Ipv4Addr::LOCALHOST
                        {
                            if let Err(e) = addr_handler() {
                                tracing::error!("Failed to send listen address: {:?}", e);
                            }
                        }
                    }
                    _ => {}
                }
            }
            SwarmEvent::ConnectionEstablished {
                peer_id,
                endpoint: ConnectedPoint::Listener { send_back_addr, .. },
                established_in,
                ..
            } => {
                tracing::info!("✔️  Connection Established to {peer_id} in {established_in:?} on {send_back_addr}");
            }

            SwarmEvent::OutgoingConnectionError { peer_id, error, .. } => {
                tracing::warn!("Failed to dial {peer_id:?}: {error}");

                match (peer_id, &error) {
                    (Some(_peer_id), libp2p::swarm::DialError::Transport(details_vector)) => {
                        for (addr, _error) in details_vector.iter() {
                            // self.swarm
                            //     .behaviour_mut()
                            //     .kademlia
                            //     .as_mut()
                            //     .map(|k| k.remove_address(&peer_id, addr));
                            //
                            // self.swarm.remove_external_address(addr);

                            tracing::debug!("Removed ADDR {addr:?} from the routing table (if it was in there).");
                        }
                    }
                    _ => {
                        tracing::warn!("{error}");
                    }
                }
            }
            SwarmEvent::ConnectionClosed { peer_id, cause, .. } => {
                tracing::debug!("Connection to {peer_id} closed: {cause:?}");
            }
            // Ping event
            SwarmEvent::Behaviour(BehaviourEvent::Ping(ping::Event {
                peer,
                result: Ok(rtt),
                ..
            })) => {
                tracing::debug!("🏓 Ping {peer} in {rtt:?}");
                // send msg
                self.event_sender
                    .send(NetworkEvent::Pong {
                        peer: peer.to_string(),
                        rtt: rtt.as_millis() as u64,
                    })
                    .await
                    .expect("Event receiver not to be dropped.");
            }
            // SwarmEvent::Behaviour(BehaviourEvent::Relay(e)) => {
            //     tracing::debug!("{:?}", e);
            // }
            // SwarmEvent::Behaviour(BehaviourEvent::Gossipsub(
            //     libp2p::gossipsub::Event::Message {
            //         message_id: _,
            //         propagation_source: _,
            //         message,
            //     },
            // )) => {
            //     tracing::info!(
            //         "📨 Received message from {:?}: {}",
            //         message.source,
            //         String::from_utf8(message.data).unwrap()
            //     );
            //
            //     /* Plugin */
            //     // iterate through registered Plugins and call on_message
            //     // for plugin in self.plugins.iter_mut() {
            //     //     let response = plugin.call("on_message", &message).unwrap();
            //     //     if let Some(response) = response {
            //     //         self.event_sender.send(response)
            //     //     }
            //     // }
            // }
            // SwarmEvent::Behaviour(BehaviourEvent::Gossipsub(
            //     libp2p::gossipsub::Event::Subscribed { peer_id, topic },
            // )) => {
            //     debug!("{peer_id} subscribed to {topic}");
            //
            //     if let Some(g) = self.swarm.behaviour_mut().gossipsub.as_mut() {
            //         g.add_explicit_peer(&peer_id)
            //     };
            //
            //     // publish a message
            //     // get the last 4 chars of the peer_id as slice:
            //     let message = format!(
            //         "📨 Welcome subscriber {}! From rust-peer at: {:4}s",
            //         &peer_id.to_string()[peer_id.to_string().len() - 4..],
            //         self.now.elapsed().as_secs()
            //     );
            //
            //     if let Some(Err(err)) = self
            //         .swarm
            //         .behaviour_mut()
            //         .gossipsub
            //         .as_mut()
            //         .map(|g| g.publish(topic::topic(), message.as_bytes()))
            //     {
            //         error!("Failed to publish periodic message: {err}")
            //     }
            // }
            // SwarmEvent::Behaviour(BehaviourEvent::Identify(identify::Event::Error {
            //     peer_id,
            //     error: libp2p::swarm::StreamUpgradeError::Timeout,
            // })) => {
            //     debug!("Identify Error to {peer_id} closed due to timeout");
            //
            //     // When a browser tab closes, we don't get a swarm event
            //     // maybe there's a way to get this with TransportEvent
            //     // but for now remove the peer from routing table if there's an Identify timeout
            //
            //     // Add a warning counter, kick off after 3 tries to Identify
            //     // if the peer is still in the routing table, remove it
            //     let warning_count = self.warning_counters.entry(peer_id).or_insert(0);
            //     *warning_count += 1;
            //
            //     debug!("⚠️  Identify count Warning for {peer_id}: {warning_count}");
            //
            //     // Remove peer after 3 non responses to Identify
            //     if *warning_count >= 3 {
            //         // remove the peer from the Kad routing table
            //         self.swarm
            //             .behaviour_mut()
            //             .kademlia
            //             .as_mut()
            //             .map(|k| k.remove_peer(&peer_id));
            //
            //         // remove from Gossipsub
            //         if let Some(g) = self.swarm.behaviour_mut().gossipsub.as_mut() {
            //             g.remove_explicit_peer(&peer_id)
            //         };
            //
            //         // remove from swarm
            //         self.swarm.disconnect_peer_id(peer_id).unwrap();
            //
            //         // remove the peer from the warning_counters HashMap
            //         self.warning_counters.remove(&peer_id);
            //         debug!("Removed PEER {peer_id} from the routing table (if it was in there).");
            //     }
            // }
            // SwarmEvent::Behaviour(BehaviourEvent::Identify(identify::Event::Received {
            //     peer_id,
            //     info:
            //         identify::Info {
            //             listen_addrs,
            //             protocols,
            //             observed_addr,
            //             ..
            //         },
            // })) => {
            //     debug!(
            //         "identify::Event::Received peer {} observed_addr: {}",
            //         peer_id, observed_addr
            //     );
            //
            //     // remove warning_counters entry for this peer if it exists
            //     self.warning_counters.remove(&peer_id);
            //
            //     // TODO: This needs to be improved to only add the address to the matching protocol name,
            //     // assuming there is more than one per kad (which there shouldn't be, but there could be)
            //     if protocols.iter().any(|p| {
            //         self.swarm
            //             .behaviour()
            //             .kademlia
            //             .as_ref()
            //             .unwrap()
            //             .protocol_names()
            //             .iter()
            //             .any(|q| p == q)
            //     }) {
            //         for addr in listen_addrs {
            //             debug!("identify::Event::Received listen addr: {}", addr);
            //
            //             let webrtc_address = addr
            //                 .clone()
            //                 .with(Protocol::WebRTCDirect)
            //                 .with(Protocol::P2p(peer_id));
            //
            //             self.swarm
            //                 .behaviour_mut()
            //                 .kademlia
            //                 .as_mut()
            //                 .map(|k| k.add_address(&peer_id, webrtc_address.clone()));
            //
            //             // TODO (fixme): the below doesn't work because the address is still missing /webrtc/p2p even after https://github.com/libp2p/js-libp2p-webrtc/pull/121
            //             self.swarm
            //                 .behaviour_mut()
            //                 .kademlia
            //                 .as_mut()
            //                 .map(|k| k.add_address(&peer_id, addr.clone()));
            //
            //             debug!("Added {webrtc_address} to the routing table.");
            //         }
            //     }
            // }
            // SwarmEvent::Behaviour(BehaviourEvent::Kademlia(
            //     libp2p::kad::KademliaEvent::OutboundQueryProgressed {
            //         result: libp2p::kad::QueryResult::Bootstrap(res),
            //         ..
            //     },
            // )) => {
            //     debug!("Kademlia BOOTSTRAP Result: {:?}", res);
            // }
            // SwarmEvent::Behaviour(BehaviourEvent::Kademlia(event)) => {
            //     debug!("Kademlia event: {:?}", event)
            // }
            event => tracing::debug!("Other type of event: {:?}", event),
        }
    }

    async fn handle_command(&mut self, command: Command) {
        match command {
            Command::StartListening { addr, sender } => {
                let _ = match self.swarm.listen_on(addr) {
                    Ok(id) => sender.send(Ok(id)),
                    Err(e) => sender.send(Err(Box::new(e))),
                };
            }
            Command::Dial { addr, sender } => {
                tracing::info!("Handling Dial command to {addr}");
                let _ = match self.swarm.dial(addr) {
                    Ok(_) => {
                        tracing::info!("Dialed successfully.");
                        sender.send(Ok(()))
                    }
                    Err(e) => sender.send(Err(Box::new(e))),
                };
            }
            Command::Publish {
                message: _,
                topic: _,
            } => {
                // if let Some(Err(err)) = self
                //     .swarm
                //     .behaviour_mut()
                //     .gossipsub
                //     .as_mut()
                //     .map(|g| g.publish(topic::new(topic), message.as_bytes()))
                // {
                //     error!("Failed to publish message: {err}");
                //     let _ = self
                //         .event_sender
                //         .send(NetworkEvent::Error {
                //             error: anyhow!("Trouble sending message: {}", err),
                //         })
                //         .await;
                // }
            }
            Command::Subscribe { topic: _ } => {
                // if let Some(Err(err)) = self
                //     .swarm
                //     .behaviour_mut()
                //     .gossipsub
                //     .as_mut()
                //     .map(|g| g.subscribe(&topic::new(topic)))
                // {
                //     error!("Failed to subscribe to topic: {err}");
                //     let _ = self
                //         .event_sender
                //         .send(NetworkEvent::Error {
                //             error: anyhow!("Trouble subscribing to topic: {}", err),
                //         })
                //         .await;
                // }
            }
        }
    }
}
