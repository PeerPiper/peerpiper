# PeerPiper for the Browser

This package provides a browser implementation of the PeerPiper protocol in the Browser. Since PeerPiper is written in Rust, this package uses WebAssembly to run the PeerPiper protocol in the browser.

## Install 

Install the package from node package manager (npm) with the following command:

```bash
npm install @peerpiper/peerpiper-browser
```

## Use 

```js
import * as peerpiper from '@peerpiper/peerpiper-browser';

// Initialize the PeerPiper WebAssembly module
await peerpiper.default();

// the multiaddress you wish to dial 
let dialAddr = '/ip6/2607:fea8:fec0:8526:11c6:f7d2:4537:bbca/udp/39849/webrtc-direct/certhash/uEiCdIot7k1VoSPrlnLvpvB15wRPn1poEOlozZkZi8jUiWw/p2p/12D3KooWGBXPH3JKKhLPMSuQmafBU2wvYXv5RKfn8QKUzYofstau';

let onEvent = (event) => {
    console.log(event);
}

peerpiper.connect(dialAddr, onEvent);

/** 
use the PeerPiper command API:

/// Publish data to a topic
{
    "action": "Publish",
    "topic": "test",
    "data": [1, 2, 3]
}

/// Subscribe to a topic
{
    "action": "Subscribe",
    "topic": "test"
}

/// Unsubscribe from a topic
{
    "action": "Unsubscribe",
    "topic": "test"
}

/// Save bytes to the storage system
{
    "action": "System",
    "Put": {
        "bytes": [1, 2, 3]
    }
}

/// Get bytes from the storage system
{
    "action": "System",
    "Get": {
        "key": "123DfQm3..."
    }
}

/// Request the server to emit the Multiaddr that it is listening on
{
    "action": "ShareAddress"
}

/// Request a response from a peer
{
    "action": "RequestResponse",
    "request": "what is your fave colour?",
    "peer_id": "123DfQm3..."
}
*/
 
let ask = { action: "RequestResponse", request: "what is your fave colour?", peer_id: "123DfQm3..." };

try {
    let ans = await pipernet.command(ask);
    // convert bytes to ArrayBuffer then string
    answer = [new TextDecoder().decode(new Uint8Array(ans))];
} catch (error) {
    console.error(error);
}
```

## Build the wasm-bindgen

Build the wasm and js glue with:

```bash
wasm-pack build --target web --release
```

or use the [Just](https://just.systems/) file in the [dir root](./justfile) with the command:

```just
just build
```

## Tests

Run the tests with:

```bash
wasm-pack test --headless --chrome
```

## Blockstore JS Bindings

The [JS Bindings](./src/blockstore/blockstore-idb.js) come from [blockstore-idb](https://www.npmjs.com/package/blockstore-idb) but [bundled into one file](https://bundlejs.com/?q=blockstore-idb%401.1.8%2Cblockstore-idb%401.1.8&treeshake=%5B*%5D%2C%5B%7BCID%7D%5D&config=%7B%22esbuild%22%3A%7B%22minify%22%3Afalse%7D%7D) so it can be Foreign Function Interfaced (FFI'd) to Rust.
