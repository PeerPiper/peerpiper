# PeerPiper Server

Starts a native node and serves the address up at [http://localhost:8080](http://localhost:8080) so your browser client can connect to it easily without copy and paste.

## Run

From this directory:

```bash
cargo run
```

From the workspace root:

```bash
cargo run --manifest-path crates/peerpiper-server/Cargo.toml
```

To run with the `cloudlfare` feature to [update `-dnsaddr` TXT record](https://github.com/libp2p/specs/blob/master/addressing/README.md#dnsaddr-links):

```bash
cargo run --manifest-path crates/peerpiper-server/Cargo.toml --features cloudflare
```
