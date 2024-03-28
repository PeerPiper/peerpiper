# PeerPiper for the Browser

This crate provides a browser implementation of the PeerPiper protocol in the Browser.

# wasm-bindgen

Build the wasm file with:

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
