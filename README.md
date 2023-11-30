# PeerPiper Rust Workspace

The core Rust library for the PeerPiper project. Holds the peer-to-peer networking logic and the core data structures.

This core functionality is intended to run locally, on a server, or embedded into another application.

# Goals

- [ ] [Peer-to-peer](https://en.wikipedia.org/wiki/Peer-to-peer) networking via [libp2p](https://libp2p.io/)
- [ ] [Peer discovery](https://en.wikipedia.org/wiki/Peer_discovery) via [Delanocreds](https://github.com/DougAnderson444/delanocreds)
- [ ] Light p2p sharing of discovery data (Cred Proofs)

# Deployment

The core library should include wrappers so that it can be deployed to various infrastructure providers:

- [ ] Browser via [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly)
- [ ] [Command Line Application](https://en.wikipedia.org/wiki/Command-line_interface) via Rust
- [ ] [Tauri](https://tauri.studio/) home, mobile, and desktop
- [ ] [Shuttle](https://shuttle.dev/) via Rust
- [ ] [Fly.io](https://fly.io/) via Docker
- [ ] [Cloudflare Workers](https://workers.cloudflare.com/) via WebAssembly
- [ ] [VPS](https://en.wikipedia.org/wiki/Virtual_private_server) via Rust
