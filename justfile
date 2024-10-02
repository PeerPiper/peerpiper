#!/usr/bin/env -S just --justfile
# ^ A shebang isn't required, but allows a justfile to be executed
#   like a script, with `./justfile test`, for example.
#
# Uses Just language syntax (https://just.systems/man/en/), to run the commands below:
update-remote:
  git submodule update --remote

# for each dir in submodules which has a `Cargo.toml` file and a `wit` directory in it, build it
build-submodules: update-remote
  for dir in submodules/*; do \
    if [ -f $dir/Cargo.toml ]; then \
      cargo component build --manifest-path=$dir/Cargo.toml --workspace --release; \
    fi \
  done

build-wits:
 for dir in crates/*; do \
   if [ -d $dir/wit ]; then \
     cargo component build --manifest-path=$dir/Cargo.toml; \
     cargo component build --manifest-path=$dir/Cargo.toml --release; \
   fi \
 done

build-examples:
 # cargo component build --manifest-path=examples/form/Cargo.toml

# update and build all submodules, then build the wallet
update-build: build-submodules build-wits

compose: update-build
  mkdir -p ./dist
  wasm-tools compose --config crates/peerpiper-wallet/config.yml -o dist/peerpiper_wallet_aggregate.wasm target/wasm32-wasi/release/peerpiper_wallet.wasm

prev:
  cd examples/svelte-app && npm run build && npm run preview -- --open

preview: compose build-examples prev

serve:
  cargo run --bin peerpiper-server

all: update-build preview

test: update-build
  cargo test --workspace --all-targets
  @just peerpiper-browser test

# The just command from crates/peerpiper-browser to build 
peerpiper-browser *args:
  @just -f crates/peerpiper-browser/justfile {{args}}

# this recipe builds the wits, then runs `npm run dev` in the packages/peerpiper-host directory
dev: build-wits 
  @trap 'kill $(jobs -p)' EXIT
  # build the browser wasm
  @just peerpiper-browser build
  # start the server
  just serve & cd packages/peerpiper-host && npm run dev -- --open

publish:
  # right now browser is the only thing that is set up to be published
  @just peerpiper-browser publish
