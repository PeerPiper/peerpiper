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
