# PeerPiper Interop tests

Tests the interaction between the browser and native nodes.

1. Install [`chromedriver`](https://googlechromelabs.github.io/chrome-for-testing/) for your platform, ensuring it is in your `PATH`. 
2. Compile the wasm with `wasm-pack build --target web --out-dir static`.
3. Run `cargo run --bin interop-tests-native` to start the native node.
4. Open the browser at the URL printed by the native node.
