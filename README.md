# PeerPiper Workspace Monorepo

The core Rust libraries and front-end examples for the PeerPiper project. Mainly holds the peer-to-peer networking logic, the core data structures, and how to use them.

The idea is to put all the reusable code in this repo so it can be linked and tested in its entirety.

# Goals

- [ ] [Peer-to-peer](https://en.wikipedia.org/wiki/Peer-to-peer) networking via [rust-libp2p](https://libp2p.io/)
- [ ] [Peer discovery](https://en.wikipedia.org/wiki/Peer_discovery) via [Delanocreds](https://github.com/DougAnderson444/delanocreds)
- [ ] Light p2p sharing of discovery data (Cred Proofs)
- [ ] (Stretch) Eventual SUITable app sharing

# Deployment

The core library should include wrappers so that it can be deployed to various infrastructure providers:

- [ ] Browser via [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly)
- [ ] Browser via [Vite](https://vitejs.dev/) and [`wasm-bindgen`](https://rustwasm.github.io/docs/wasm-bindgen/)
- [ ] [Command Line Application](https://en.wikipedia.org/wiki/Command-line_interface) via Rust
- [ ] [Tauri](https://tauri.studio/) home, mobile, and desktop
- [ ] [Shuttle](https://shuttle.dev/) via Rust
- [ ] [Fly.io](https://fly.io/) via Docker
- [ ] [Cloudflare Workers](https://workers.cloudflare.com/) via WebAssembly
- [ ] [VPS](https://en.wikipedia.org/wiki/Virtual_private_server) via Rust
