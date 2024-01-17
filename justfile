#!/usr/bin/env -S just --justfile
# ^ A shebang isn't required, but allows a justfile to be executed
#   like a script, with `./justfile test`, for example.
#
# Uses Just language syntax (https://just.systems/man/en/), to run the commands below:
update-remote:
  git submodule update --remote

# for each dir in submodules which has a `Cargo.toml` file and a `wit` directory in it, build it
build-submodules:
  for dir in submodules/*; do \
    if [ -f $dir/Cargo.toml ]; then \
      cargo component build --manifest-path=$dir/Cargo.toml --workspace --release; \
    fi \
  done

build-wallet:
 cargo component build --manifest-path=crates/peerpiper-wallet/Cargo.toml --release

compose-wallet:
  wasm-tools compose --config crates/peerpiper-wallet/config.yml -o dist/peerpiper_wallet_aggregate.wasm target/wasm32-wasi/release/peerpiper_wallet.wasm

# Just recipe to update, build, and compose all the things
# to run: `just compose`
compose: update-remote build-submodules build-wallet compose-wallet

preview: compose
  cd examples/svelte-app && npm run build && npm run preview -- --open
