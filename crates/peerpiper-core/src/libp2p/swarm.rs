use libp2p::{identity::Keypair, swarm::NetworkBehaviour};
use std::time::Duration;

pub fn create<B: NetworkBehaviour>(
    behaviour_constructor: impl FnOnce(&Keypair) -> B,
) -> Result<libp2p::Swarm<B>, String> {
    #[cfg(target_arch = "wasm32")]
    {
        Ok(libp2p::SwarmBuilder::with_new_identity()
            .with_wasm_bindgen()
            .with_other_transport(|key| {
                libp2p_webrtc_websys::Transport::new(libp2p_webrtc_websys::Config::new(&key))
            })
            .expect("infalliable to never exist")
            .with_behaviour(behaviour_constructor)
            .expect("infalliable to never exist")
            // Ping does not KeepAlive, so we set the idle connection timeout to 32_212_254u64,
            // which is the largest value that works with the wasm32 target.
            .with_swarm_config(|c| {
                c.with_idle_connection_timeout(Duration::from_secs(32_212_254u64))
            })
            .build())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use libp2p::{core::muxing::StreamMuxerBox, core::Transport};
        use rand::thread_rng;
        Ok(libp2p::SwarmBuilder::with_new_identity()
            .with_tokio()
            .with_quic()
            .with_other_transport(|id_keys| {
                Ok(libp2p_webrtc::tokio::Transport::new(
                    id_keys.clone(),
                    libp2p_webrtc::tokio::Certificate::generate(&mut thread_rng())?,
                )
                .map(|(peer_id, conn), _| (peer_id, StreamMuxerBox::new(conn))))
            })
            .map_err(|e| e.to_string())?
            .with_behaviour(behaviour_constructor)
            .map_err(|e| e.to_string())?
            .with_swarm_config(|cfg| {
                cfg.with_idle_connection_timeout(Duration::from_secs(u64::MAX))
            })
            .build())
    }
}
