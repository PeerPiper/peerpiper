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

## Cloudflare DNS 

To publish your server's multiaddress to a Cloudflare DNS record so it can be found easily via DNS, you need to set the following environment variables:

- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token 
- `CLOUDFLARE_ZONE_ID` - Your Cloudflare Zone ID 
- `CLOUDFLARE_DNS_NAME` - The DNS name you want to update, ex: `_dnsaddr.peerpiper.io`

Then, run the server with the `cloudflare` feature:

To run with the `cloudlfare` feature to [update `-dnsaddr` TXT record](https://github.com/libp2p/specs/blob/master/addressing/README.md#dnsaddr-links):

```bash
cargo run --manifest-path crates/peerpiper-server/Cargo.toml --features cloudflare
```

This will enable the [`_dnsaddr` endpoint](https://github.com/multiformats/multiaddr/blob/master/protocols/DNSADDR.md) which will update the DNS record with the multiaddress of the node.

## Extensions 

The `extensions` feature is enabled by default, allowing you to use WIT components to handle PeerPiper event traffic for you. 

## WIT Dependency 

In order for `wasmtime::component::bindgen!()` macro to work, there needs to be a WIT file in the `wit` directory. This Wasm Interface must be consistent across all extensions for the interface calls to also be the same. This means we can use a single WIT file for all extensions. Given this fact, we can simply use a symlink to the [echo](../extension-echo/wit/world.wit) extension WIT file and it will apply to all extensions.


