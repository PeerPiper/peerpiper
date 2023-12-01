pub mod behaviour;
pub mod swarm;

// use crate::error::Error;

// pub async fn spawn_swarm(libp2p_endpoint: String) -> Result<(), Error> {
//     tracing::info!("Spawning swarm. Using multiaddr {:?}", libp2p_endpoint);
//
//     let mut swarm = swarm::create(behaviour::build).map_err(|e| Error::String(e.to_string()))?;
//
//     Ok(())
// }
