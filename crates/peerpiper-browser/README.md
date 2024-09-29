# PeerPiper for the Browser

This package provides a browser implementation of the PeerPiper protocol in the Browser.

## Use 

```js
import peerpiper from 'peerpiper-browser';


let pipernet = await peerpiper();

// the multiaddress you wish to dial 
let dialAddr = '/ip6/2607:fea8:fec0:8526:11c6:f7d2:4537:bbca/udp/39849/webrtc-direct/certhash/uEiCdIot7k1VoSPrlnLvpvB15wRPn1poEOlozZkZi8jUiWw/p2p/12D3KooWGBXPH3JKKhLPMSuQmafBU2wvYXv5RKfn8QKUzYofstau';

let onEvent = (event) => {
    console.log(event);
}

pipernet.connect(dialAddr, onEvent);

// use the PeerPiper command API
// Publish {
//    topic: String,
//    data: Vec<u8>,
// },
// Subscribe {
//    topic: String,
// },
// Unsubscribe {
//    topic: String,
// },
// RequestResponse {
//    request: String,
//    peer_id: String,
// }
let ask = { RequestResponse: { request: question, peer_id: peerid } };
ask = JSON.stringify(ask);

try {
    let a = await pipernet.command(ask);
    // convert bytes to ArrayBuffer then string
    answer = [new TextDecoder().decode(new Uint8Array(a))];
} catch (error) {
    console.error(error);
}
```

# wasm-bindgen

Build the wasm and js glue with:

```bash
wasm-pack build --target web --release
```

## Tests

Run the tests with:

```bash
wasm-pack test --headless --chrome
```

## Blockstore JS Bindings

The [JS Bindings](./src/blockstore/blockstore-idb.js) come from [blockstore-idb](https://www.npmjs.com/package/blockstore-idb) but [bundled into one file](https://bundlejs.com/?q=blockstore-idb%401.1.8%2Cblockstore-idb%401.1.8&treeshake=%5B*%5D%2C%5B%7BCID%7D%5D&config=%7B%22esbuild%22%3A%7B%22minify%22%3Afalse%7D%7D) so it can be Foreign Function Interfaced (FFI'd) to Rust.
