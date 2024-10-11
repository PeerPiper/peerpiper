use crate::events::{Events, Network, NetworkError, PeerPiperCommand, PublicEvent};
use crate::libp2p::behaviour::{Behaviour, BehaviourEvent};
use crate::libp2p::error::Error;
use futures::StreamExt;
use futures::{
    channel::{
        mpsc::{self, Receiver},
        oneshot,
    },
    SinkExt,
};
use libp2p::core::transport::ListenerId;
use libp2p::kad::store::RecordStore;
use libp2p::multiaddr::Protocol;
use libp2p::request_response::{self, OutboundRequestId, ResponseChannel};
use libp2p::swarm::{Swarm, SwarmEvent};
use libp2p::{identify, kad, ping, Multiaddr, PeerId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::ops::Deref;
use std::time::Duration;

use super::delay;

const TICK_INTERVAL: Duration = Duration::from_secs(15);

/// Create new API to interact with the network:
///
/// - Network Client: Interact with the netowrk by sending
/// - Network Event Loop: Start the network event loop
pub async fn new(swarm: Swarm<Behaviour>) -> (Client, Receiver<Events>, EventLoop) {
    // These command senders/recvr are used to pass along parsed generic commands to the network event loop
    let (command_sender, command_receiver) = mpsc::channel(8);
    let (event_sender, event_receiver) = mpsc::channel(8);

    (
        Client { command_sender },
        event_receiver,
        EventLoop::new(swarm, command_receiver, event_sender),
    )
}

#[derive(Clone)]
pub struct Client {
    command_sender: mpsc::Sender<Command>,
}

impl Client {
    /// Listen for incoming connections on the given address.
    pub async fn start_listening(&mut self, addr: Multiaddr) -> Result<ListenerId, Error> {
        let (sender, receiver) = oneshot::channel();
        self.command_sender
            .send(Command::StartListening { addr, sender })
            .await?;
        receiver.await?
    }
    /// Dial the given addresses
    pub async fn dial(&mut self, addr: Multiaddr) -> Result<(), Error> {
        let (sender, receiver) = oneshot::channel();
        self.command_sender
            .send(Command::Dial { addr, sender })
            .await?;
        receiver.await?
    }

    /// Request a response from a PeerId
    pub async fn request_response(
        &mut self,
        request: Vec<u8>,
        peer: PeerId,
    ) -> Result<Vec<u8>, Error> {
        tracing::trace!("Sending request to {peer}");
        let (sender, receiver) = oneshot::channel();
        if let Err(e) = self
            .command_sender
            .send(Command::Jeeves {
                request,
                peer,
                sender,
            })
            .await
        {
            tracing::error!("Failed to send request response command: {:?}", e);
        }

        receiver.await.map_err(Error::OneshotCanceled)?
    }
    /// Respond with a file to a request
    pub async fn respond_bytes(
        &mut self,
        bytes: Vec<u8>,
        channel: ResponseChannel<PeerResponse>,
    ) -> Result<(), Error> {
        self.command_sender
            .send(Command::RespondJeeves { bytes, channel })
            .await
            .map_err(Error::SendError)
    }
    pub async fn add_peer(&mut self, peer_id: PeerId) -> Result<(), Error> {
        self.command_sender
            .send(Command::AddPeer { peer_id })
            .await
            .map_err(Error::SendError)
    }
    pub async fn publish(&mut self, message: impl AsRef<[u8]>, topic: String) -> Result<(), Error> {
        self.command_sender
            .send(Command::Publish {
                message: message.as_ref().to_vec(),
                topic,
            })
            .await
            .map_err(Error::SendError)
    }
    pub async fn subscribe(&mut self, topic: String) -> Result<(), Error> {
        self.command_sender
            .send(Command::Subscribe { topic })
            .await
            .map_err(Error::SendError)
    }
    /// General command PeerPiperCommand parsed into Command then called
    pub async fn command(&mut self, command: PeerPiperCommand) -> Result<(), Error> {
        self.command_sender
            .send(command.into())
            .await
            .map_err(Error::SendError)
    }
    /// Run the Client loop, awaiting commands and passing along network events.
    // Loop awaits two separate futures using select:
    // 1) Network_events.select_next_some()
    // 2) Recieved Network Commands via `command_receiver`, passing along PeerPiperCommand to network_client.command(pp_cmd)
    pub async fn run(
        &mut self,
        mut network_events: Receiver<Events>,
        mut command_receiver: Receiver<PeerPiperCommand>,
        mut tx: mpsc::Sender<Events>,
    ) {
        loop {
            futures::select! {
                event = network_events.select_next_some() => {
                    tracing::trace!("Network event: {:?}", event);
                    if let Err(network_event) = tx.send(event).await {
                        tracing::error!("Failed to send swarm event: {:?}", network_event);
                        // break;
                        continue;
                    }
                },
                command = command_receiver.next() => {
                    tracing::trace!("Received command");
                    // PeerPiperCommands cannot have channels in them, as they are not serializable
                    // So here we have to match on those with channels (.request_response), versus those without
                    if let Some(pp_cmd) = command {
                       if let Err(e) = self.command(pp_cmd).await {
                            tracing::error!("Failed to run command: {:?}", e);
                        }
                    }
                }
            }
        }
    }
}

/// Libp2p Commands
#[derive(Debug)]
enum Command {
    StartListening {
        addr: Multiaddr,
        sender: oneshot::Sender<Result<ListenerId, Error>>,
    },
    Dial {
        addr: Multiaddr,
        sender: oneshot::Sender<Result<(), Error>>,
    },
    Publish {
        message: Vec<u8>,
        topic: String,
    },
    Subscribe {
        topic: String,
    },
    Unsubscribe {
        topic: String,
    },
    AddPeer {
        peer_id: PeerId,
    },
    ShareMultiaddr,
    /// Jeeves RequestResponse. Ask a String from a PeerId.
    Jeeves {
        request: Vec<u8>,
        peer: PeerId,
        sender: oneshot::Sender<Result<Vec<u8>, Error>>,
    },
    /// Jeeves Response
    RespondJeeves {
        bytes: Vec<u8>,
        channel: ResponseChannel<PeerResponse>,
    },
    /// Puts a Record on the DHT
    PutRecord {
        key: Vec<u8>,
        value: Vec<u8>,
    },
}

/// Libp2p Events
#[derive(Debug)]
pub enum Libp2pEvent {
    /// The unique Event to this api file that never leaves; all other events propagate out
    InboundRequest {
        request: PeerRequest,
        channel: ResponseChannel<PeerResponse>,
    },
}

/// Simple file exchange protocol
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerRequest(Vec<u8>);

impl Deref for PeerRequest {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// Jeeves Response Bytes
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerResponse(Vec<u8>);

impl Deref for PeerResponse {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<PeerPiperCommand> for Command {
    fn from(command: PeerPiperCommand) -> Self {
        match command {
            PeerPiperCommand::Publish { topic, data } => Command::Publish {
                topic,
                message: data,
            },
            PeerPiperCommand::Subscribe { topic } => Command::Subscribe { topic },
            PeerPiperCommand::Unsubscribe { topic } => Command::Unsubscribe { topic },
            PeerPiperCommand::ShareAddress => Command::ShareMultiaddr,
            PeerPiperCommand::PutRecord { key, value } => Command::PutRecord { key, value },
            _ => unimplemented!(),
        }
    }
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
    event_sender: mpsc::Sender<Events>,
    /// Jeeeves Tracking
    pending_requests: HashMap<OutboundRequestId, oneshot::Sender<Result<Vec<u8>, Error>>>,
}

impl EventLoop {
    /// Creates a new network event loop.
    fn new(
        swarm: Swarm<Behaviour>,
        command_receiver: mpsc::Receiver<Command>,
        event_sender: mpsc::Sender<Events>,
    ) -> Self {
        Self {
            tick: delay::Delay::new(TICK_INTERVAL),
            swarm,
            command_receiver,
            event_sender,
            pending_requests: HashMap::new(),
        }
    }

    /// Runs the network event loop.
    pub async fn run(mut self) -> Result<(), Error> {
        loop {
            futures::select! {
                event = self.swarm.next() => self.handle_event(event.expect("Swarm stream to be infinite.")).await?,
                command = self.command_receiver.next() => match command {
                    Some(c) => self.handle_command(c).await,
                    // Command channel closed, thus shutting down the network event loop.
                    None => return Ok(()),
                },
                _ = &mut self.tick => self.handle_tick().await,
            }
        }
    }

    /// Handles a tick of the `tick` future.
    async fn handle_tick(&mut self) {
        tracing::info!("🕒 Tick");
        self.tick.reset(TICK_INTERVAL);

        // Also show all kad records from kad store
        let records = self.swarm.behaviour_mut().kad.store_mut().records();

        if records.clone().count() == 0 {
            tracing::trace!("Kad store is empty");
        }

        records.into_iter().for_each(|record| {
            tracing::debug!(
                "Kad Key/Value: {:?} {:?}",
                record.key.to_vec(),
                record.value
            );
        });

        // if let Some(Err(e)) = self
        //     .swarm
        //     .behaviour_mut()
        //     .kademlia
        //     .as_mut()
        //     .map(|k| k.bootstrap())
        // {
        //     tracing::debug!("Failed to run Kademlia bootstrap: {e:?}");
        // }

        let _message = "Hello world! Sent from the rust-peer".to_string();

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
    async fn handle_event(&mut self, event: SwarmEvent<BehaviourEvent>) -> Result<(), Error> {
        match event {
            SwarmEvent::NewListenAddr { address, .. } => {
                tracing::info!("🌐  Listen address: {address}");
                let mut addr_handler = || {
                    let p2p_addr = address
                        .clone()
                        .with(Protocol::P2p(*self.swarm.local_peer_id()));

                    // info!("Listen p2p address: \n\x1b[30;1;42m{p2p_addr}\x1b[0m");
                    // This address is reachable, add it
                    self.swarm.add_external_address(p2p_addr.clone());

                    // check off adding this address
                    tracing::info!("👉  Added {p2p_addr}");

                    // pass the address back to the other task, for display, etc.
                    self.event_sender
                        .try_send(Events::Outer(PublicEvent::ListenAddr {
                            address: p2p_addr.clone(),
                            network: Network::Libp2p,
                        }))
                };
                // Protocol::Ip is the first item in the address vector
                match address.iter().next() {
                    Some(Protocol::Ip6(ip6)) => {
                        // Only add our globally available IPv6 addresses to the external addresses list.
                        if !ip6.is_loopback()
                            && !ip6.is_unspecified()
                            && !ip6.is_unicast_link_local()
                        // no fe80::/10 addresses
                        {
                            if let Err(e) = addr_handler() {
                                tracing::error!("Failed to send listen address: {:?}", e);
                                return Err(Error::StaticStr("Failed to send listen address"));
                            }
                        }
                    }
                    Some(Protocol::Ip4(ip4)) => {
                        if !ip4.is_loopback() && !ip4.is_unspecified() && ip4 != Ipv4Addr::LOCALHOST
                        {
                            if let Err(e) = addr_handler() {
                                tracing::error!("Failed to send listen address: {:?}", e);
                                return Err(Error::StaticStr("Failed to send listen address"));
                            }
                        }
                    }
                    _ => {
                        tracing::warn!("Unknown address type: {address}");
                    }
                }
            }
            SwarmEvent::ConnectionEstablished {
                peer_id,
                //endpoint: ConnectedPoint::Listener { send_back_addr, .. },
                established_in,
                ..
            } => {
                tracing::info!("✔️  Connection Established to {peer_id} in {established_in:?}");
                // add as explitcit peer
                self.swarm
                    .behaviour_mut()
                    .gossipsub
                    .add_explicit_peer(&peer_id);

                if let Err(e) = self
                    .event_sender
                    .send(Events::Outer(PublicEvent::NewConnection {
                        peer: peer_id.to_string(),
                    }))
                    .await
                {
                    tracing::error!("Failed to send NewConnection event: {e}");
                    return Err(Error::StaticStr("Failed to send NewConnection event"));
                }
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
                        return Err(Error::StaticStr("Failed to dial peer"));
                    }
                }
            }
            SwarmEvent::ConnectionClosed { peer_id, cause, .. } => {
                tracing::info!("Connection to {peer_id} closed: {cause:?}");
                // send an event
                self.event_sender
                    .send(Events::Outer(PublicEvent::ConnectionClosed {
                        peer: peer_id.to_string(),
                        // unwrap cause if is Some, otherwise return "Unknown cause"
                        cause: cause
                            .map(|c| c.to_string())
                            .unwrap_or_else(|| "Unknown cause".to_string()),
                    }))
                    .await?;
            }
            SwarmEvent::Behaviour(BehaviourEvent::Ping(ping::Event {
                peer,
                result: Ok(rtt),
                ..
            })) => {
                tracing::info!("🏓 Ping {peer} in {rtt:?}");
                // send msg
                self.event_sender
                    .send(Events::Outer(PublicEvent::Pong {
                        peer: peer.to_string(),
                        rtt: rtt.as_millis() as u64,
                    }))
                    .await?;
            }
            SwarmEvent::Behaviour(BehaviourEvent::Ping(ping::Event {
                peer,
                result: Err(err),
                connection,
            })) => {
                tracing::warn!("⚠️  Ping {peer} failed: {err}");
                self.swarm.behaviour_mut().kad.remove_peer(&peer);
                let found = self.swarm.close_connection(connection);
                tracing::warn!("Connection closed: {found}");
            }
            // SwarmEvent::Behaviour(BehaviourEvent::Relay(e)) => {
            //     tracing::debug!("{:?}", e);
            // }
            SwarmEvent::Behaviour(BehaviourEvent::Gossipsub(
                libp2p::gossipsub::Event::Message {
                    message_id: _,
                    propagation_source: peer_id,
                    message,
                },
            )) => {
                tracing::info!("📨 Received message from {:?}", message.source);

                self.event_sender
                    .send(Events::Outer(PublicEvent::Message {
                        peer: peer_id.to_string(),
                        topic: message.topic.to_string(),
                        data: message.data,
                    }))
                    .await?;
            }
            SwarmEvent::Behaviour(BehaviourEvent::Gossipsub(
                libp2p::gossipsub::Event::Subscribed { peer_id, topic },
            )) => {
                tracing::debug!("{peer_id} subscribed to {topic}");

                // Indiscriminately add the peer to the routing table
                self.swarm
                    .behaviour_mut()
                    .gossipsub
                    .add_explicit_peer(&peer_id);

                // publish a message
                // get the last 4 chars of the peer_id as slice:
                let message = format!(
                    "📨 Welcome subscriber ..{} of topic {:?}! 🎉",
                    &peer_id.to_string()[peer_id.to_string().len() - 4..],
                    topic
                );

                // subscribe to this topic so we can act as super peer to browsers
                if let Err(err) = self
                    .swarm
                    .behaviour_mut()
                    .gossipsub
                    .subscribe(&libp2p::gossipsub::IdentTopic::new(topic.as_str()))
                {
                    tracing::error!("Failed to subscribe to topic: {err}");
                }

                if let Err(err) = self
                    .swarm
                    .behaviour_mut()
                    .gossipsub
                    .publish(topic, message.as_bytes())
                {
                    tracing::error!("Failed to publish welcome message: {err}");
                    return Err(Error::StaticStr("Failed to publish welcome message"));
                }
            }
            SwarmEvent::Behaviour(BehaviourEvent::PeerRequest(
                request_response::Event::Message { message, .. },
            )) => match message {
                request_response::Message::Request {
                    request, channel, ..
                } => {
                    tracing::trace!("Received request: {:?}", request.0);

                    // this emits an event to the user so that they can
                    // respond to the request in the manner they see fit
                    self.event_sender
                        .send(Events::Inner(Libp2pEvent::InboundRequest {
                            request,
                            channel,
                        }))
                        .await?;
                }
                request_response::Message::Response {
                    request_id,
                    response,
                } => self
                    .pending_requests
                    .remove(&request_id)
                    .ok_or(Error::StaticStr("Remove failed"))?
                    .send(Ok(response.0))
                    .map_err(|_| Error::StaticStr("Failed to send response"))?,
            },
            SwarmEvent::Behaviour(BehaviourEvent::PeerRequest(
                request_response::Event::OutboundFailure {
                    request_id,
                    error,
                    peer,
                    ..
                },
            )) => {
                tracing::error!(
                    "Request failed, couldn't SEND JEEVES to peer {peer}: {error} on request_id: {request_id}"
                );
                self.pending_requests
                    .remove(&request_id)
                    .ok_or(Error::StaticStr("Remove failed"))?
                    .send(Err(Error::OutboundFailure(error)))
                    .map_err(|_| Error::StaticStr("Failed to send response"))?;
            }
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
            //         // remove from swarm. TODO: rm unwrap
            //         // self.swarm.disconnect_peer_id(peer_id).unwrap();
            //
            //         // remove the peer from the warning_counters HashMap
            //         self.warning_counters.remove(&peer_id);
            //         debug!("Removed PEER {peer_id} from the routing table (if it was in there).");
            //     }
            // }
            SwarmEvent::Behaviour(BehaviourEvent::Identify(identify::Event::Received {
                peer_id,
                info:
                    identify::Info {
                        listen_addrs,
                        protocols,
                        observed_addr,
                        ..
                    },
                ..
            })) => {
                tracing::debug!(
                    "ℹ️  identify Received peer {} observed_addr: {}",
                    peer_id,
                    observed_addr
                );

                // remove warning_counters entry for this peer if it exists
                //self.warning_counters.remove(&peer_id);

                // Only add the address to the matching protocol name,
                if protocols.iter().any(|p| {
                    self.swarm
                        .behaviour()
                        .kad
                        .protocol_names()
                        .iter()
                        .any(|q| p == q)
                }) {
                    for addr in listen_addrs {
                        tracing::debug!("ℹ️  identify::Event::Received listen addr: {}", addr);

                        let webrtc_address = addr
                            .clone()
                            .with(Protocol::WebRTCDirect)
                            .with(Protocol::P2p(peer_id));

                        self.swarm
                            .behaviour_mut()
                            .kad
                            .add_address(&peer_id, webrtc_address.clone());

                        // TODO (fixme): the below doesn't work because the address is still missing /webrtc/p2p even after https://github.com/libp2p/js-libp2p-webrtc/pull/121
                        self.swarm
                            .behaviour_mut()
                            .kad
                            .add_address(&peer_id, addr.clone());

                        tracing::debug!("ℹ️  Added {peer_id} to the routing table.");
                    }
                }
            }
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
            event => {
                tracing::debug!("Other type of event: {:?}", event);
            }
        }
        Ok(())
    }

    async fn handle_command(&mut self, command: Command) {
        match command {
            Command::StartListening { addr, sender } => {
                let _ = match self.swarm.listen_on(addr) {
                    Ok(id) => sender.send(Ok(id)),
                    Err(e) => sender.send(Err(Error::TransportIo(e))),
                };
            }
            Command::Dial { addr, sender } => {
                let _ = match self.swarm.dial(addr) {
                    Ok(_) => sender.send(Ok(())),
                    Err(e) => sender.send(Err(Error::DialError(e))),
                };
            }
            Command::Publish { message, topic } => {
                tracing::info!("API: Handling Publish command to {topic}");
                let top = libp2p::gossipsub::IdentTopic::new(&topic);
                if let Err(err) = self.swarm.behaviour_mut().gossipsub.publish(top, message) {
                    tracing::error!("Failed to publish message: {err}");

                    // list of all peers
                    let peers = self
                        .swarm
                        .behaviour()
                        .gossipsub
                        .all_peers()
                        .collect::<Vec<_>>();
                    // show explicit peers
                    tracing::info!("All peers: {:?}", peers);

                    // let _ = self
                    //     .event_sender
                    //     .send(Event::Error {
                    //         error: NetworkError::PublishFailed,
                    //     })
                    //     .await;
                }
                tracing::info!("API: Successfully Published to {topic}");
            }
            Command::Subscribe { topic } => {
                tracing::info!("API: Handling Subscribe command to {topic}");
                if let Err(err) = self
                    .swarm
                    .behaviour_mut()
                    .gossipsub
                    .subscribe(&libp2p::gossipsub::IdentTopic::new(&topic))
                {
                    tracing::error!("Failed to subscribe to topic: {err}");
                    let _ = self
                        .event_sender
                        .send(Events::Outer(PublicEvent::Error {
                            error: NetworkError::SubscribeFailed,
                        }))
                        .await;
                }
                tracing::info!("API: Successfully Subscribed to {topic}");
            }
            Command::Unsubscribe { topic } => {
                if let Err(err) = self
                    .swarm
                    .behaviour_mut()
                    .gossipsub
                    .unsubscribe(&libp2p::gossipsub::IdentTopic::new(topic))
                {
                    tracing::error!("Failed to unsubscribe from topic: {err}");
                    let _ = self
                        .event_sender
                        .send(Events::Outer(PublicEvent::Error {
                            error: NetworkError::UnsubscribeFailed,
                        }))
                        .await;
                }
            }
            // Add Explicit Peer by PeerId
            Command::AddPeer { peer_id } => {
                self.swarm
                    .behaviour_mut()
                    .gossipsub
                    .add_explicit_peer(&peer_id);
                tracing::info!("API: Added Peer {peer_id} to the routing table.");
            }
            // Share the current Multiaddr for the server
            Command::ShareMultiaddr => {
                let p2p_addr = self
                    .swarm
                    .external_addresses()
                    .next()
                    .expect("Expected at least one external address.")
                    .clone()
                    .with(Protocol::P2p(*self.swarm.local_peer_id()));

                // emit as Event
                if let Err(e) = self
                    .event_sender
                    .try_send(Events::Outer(PublicEvent::ListenAddr {
                        address: p2p_addr.clone(),
                        network: Network::Libp2p,
                    }))
                {
                    tracing::error!("Failed to send share address event: {e}");
                }
            }
            Command::Jeeves {
                request,
                peer,
                sender,
            } => {
                tracing::info!("API: Handling RequestResponse command to {peer}");
                let response_id = self
                    .swarm
                    .behaviour_mut()
                    .peer_request
                    .send_request(&peer, PeerRequest(request));
                self.pending_requests.insert(response_id, sender);
            }
            Command::RespondJeeves {
                bytes: file,
                channel,
            } => {
                tracing::info!("API: Handling RespondFile command");
                self.swarm
                    .behaviour_mut()
                    .peer_request
                    .send_response(channel, PeerResponse(file))
                    .expect("Connection to peer to be still open.");
            }
            // Put Records on the DHT
            Command::PutRecord { key, value } => {
                tracing::info!("API: Handling PutRecord command");
                let record = kad::Record::new(key, value);
                let _ = self
                    .swarm
                    .behaviour_mut()
                    .kad
                    .put_record(record, kad::Quorum::One);
            }
        }
    }
}
