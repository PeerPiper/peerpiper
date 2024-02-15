# PeerPiper Interop tests

Tests the interaction between the browser and native nodes.

1. Install [`chromedriver`](https://googlechromelabs.github.io/chrome-for-testing/) for your platform, ensuring it is in your `PATH`. 

2. Compile the browser wasm:

```bash
wasm-pack build --target web --out-dir static
```

3.To start the native node, run:

```bash
cargo run --bin interop-tests-native
```

4. Open the browser at the URL printed by the native node.

The above steps are streamlined using [`just`](https://just.systems/). Run `just` to see the available commands:

```bash
just all
```
