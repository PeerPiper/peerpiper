# PeerPiper Workspace Monorepo

🚧 Alpha level software. The docs are a bit rough, but will give you an outline of the vision. Raise an issue if you run into troubles.

The core Rust libraries and front-end examples for the PeerPiper project. Mainly holds the peer-to-peer networking logic, the core data structures, and how to use them.

The idea is to put all the reusable code in this repo so it can be linked and tested in its entirety.

# Goals

PeerPiper is an contacts network based on the `PeerWise Protocol` that allows you to share data with others in a peer-to-peer fashion. It's a bit like a social network, but you own your data and can share it with others in a more granular way.

### 🔗 [PeerPiper PeerWise Protocol GreenPaper](https://peerpiper.io/paper)

- [x] No blockchain required
- [x] Default [Peer-to-peer](https://en.wikipedia.org/wiki/Peer-to-peer) networking via [rust-libp2p](https://libp2p.io/)
- [x] [Modular, Composable Wallet](./crates/peerpiper-wallet/) (add your own plugins) via [Wasm Components](https://component-model.bytecodealliance.org/introduction.html)
- [x] [Plaintext Peer discovery](https://en.wikipedia.org/wiki/Peer_discovery) (name, email, phone, etc.) via [Delanocreds](https://github.com/DougAnderson444/delanocreds)
- [ ] 🚧 **Modular, Composable, Templatable** app & data sharing
- [ ] 🚧 Add your own publishing network (Nostr, Farcaster, AT Protocol, etc.)
 
![PeerPiper Architecture](./peerpiper_arch.png)

# Deployment

The core library should include wrappers so that it can be deployed to various infrastructure providers:

- [x] Browser via [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly), [Vite](https://vitejs.dev/) & [`wasm-bindgen`](https://rustwasm.github.io/docs/wasm-bindgen/)
- [x] [Command Line](https://en.wikipedia.org/wiki/Command-line_interface) via Rust
- [ ] [Tauri](https://tauri.studio/) home, mobile, and desktop
- [ ] [Shuttle](https://shuttle.dev/) via Rust
- [ ] [Fly.io](https://fly.io/) via Docker
- [ ] [Cloudflare Workers](https://workers.cloudflare.com/) via WebAssembly
- [ ] [VPS](https://en.wikipedia.org/wiki/Virtual_private_server) via Rust
- [ ] [Web3.storage](https://web3.storage/) via HTTP
- [ ] [Fireproof DB](https://use-fireproof.com/) via HTTP

# Development dependencies

You'll need a few dependencies to get started:

### 🦀 [Rust](https://www.rust-lang.org/)

- [x] [Rust](https://www.rust-lang.org/) 1.78+ (use nightly as stipulated in the `rust-toolchain.toml` file)
- [x] Add `wasm32-wasi` target: `rustup target add wasm32-wasi`
- [x] Add `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`

### 📦 [cargo-component](https://github.com/bytecodealliance/cargo-component)

- [x] [cargo-component](https://github.com/bytecodealliance/cargo-component)

Using [`binstall`](https://github.com/cargo-bins/cargo-binstall): `cargo binstall cargo-component@0.10.1`

Note that `cargo-component` is a work in progress and may not be stable. Configs, settings, and commands may change from version to version.

### ⚖️  [Just](https://just.systems/) 

- [x] [Just](https://just.systems/) makes running batch commands easier. There's a `justfile` in the root of the project.

## Development

Many of the commands used in development are in the `justfile`. You can see them by running `just`.
