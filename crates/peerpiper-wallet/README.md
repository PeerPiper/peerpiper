# Peerpiper Wallet

An aggregate wallet for Peerpiper, made from the following WebAssembly Components:

- [`seed-keeper-wit`](https://github.com/DougAnderson444/seed-keeper/tree/master/crates/seed-keeper-wit) - To manage the 32 bytes seed
- [`seed-keeper-wit-ui`](https://github.com/DougAnderson444/seed-keeper/tree/master/crates/seed-keeper-wit-ui) - User Interface Engine
- [`delano-wallet`](https://github.com/DougAnderson444/delanocreds/tree/master/crates/delano-wallet) - Delegatable Anonymous Credentials
- [`delano-wit-ui`](https://github.com/DougAnderson444/delanocreds/tree/master/crates/delano-wit-ui) - Delano User Interface Engine

Future:
- [`recrypted`](https://github.com/DougAnderson444/recrypted) - Transform re-encryption

# Development

This crate is an aggregate of guest WIT components. Each guest needs to be added. Below are the steps to add a new guest.

## Cloning w/ links to external repos via git submodules

The Wallet architecture makes it safe and easy to use other people's code, due to the sandboxing of WebAssembly. Thus, the code you want to use is likely in someone else's repository. We need their:

1. *.wasm binary, and;
2. *.wit file

This crates uses [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) to link to those external repos so we can build from their source and link to their Wasm Interfaces (WIT). 

To clone this repo and the submodules use:

```bash
git clone --recurse-submodules
```

If you already cloned the project and forgot `--recurse-submodules`, you can combine the `git submodule init` and `git submodule update` steps by running `git submodule update --init`. To also initialize, fetch and checkout any nested submodules, you can use the foolproof `git submodule update --init --recursive`.

### Updating submodules

If the source repo changed, you can always update the submodules to the latest commit with:

```bash
git submodule update --remote
```

### Add new Guest submodule

If you want to add even more functionality to the wallet, you can add a new guest.

If we wanted to add the [`delanocreds`](https://github.com/DougAnderson444/delanocreds) repo as a submodule, in the root of the workspace, run:

```bash
git submodule add https://github.com/DougAnderson444/delanocreds.git submodules/delanocreds
```

## Symlink to wit files

In order to run tests on our aggregate we have made symlinks to their `.wit` files in our `./wit/deps` folder. In order to avoid copy-pasting, we can instead symlink the files like this:

```bash
cd wit/deps
ln -s ../../../../../submodules/seed-keeper/crates/seed-keeper-wit-ui/wit/index.wit
```

## Build & Compose

Ensure that the submodules are built:

```bash
cargo component build --manifest-path=submodules/seed-keeper/Cargo.toml --workspace --release
cargo component build --manifest-path=submodules/delanocreds/crates/delano-wallet/Cargo.toml --release
cargo component build --manifest-path=submodules/delanocreds/crates/delano-wit-ui/Cargo.toml --release
```

That will makes the `*.wasm` files available to the [`config.yml`](./config.yml) so we can compose them together.

Next build the wallet itself:

```bash
cd crates/peerpiper-wallet
cargo component build --release
```

Then use `wasm-tools` to `compose` the dependencies into an aggregate wallet, run:

```bash
# from workspace root dir
wasm-tools compose --config crates/peerpiper-wallet/config.yml -o dist/peerpiper_wallet_aggregate.wasm target/wasm32-wasi/release/peerpiper_wallet.wasm
```

## JustFile

All of the commands above are saved into a [`justfile`](../../justfile) in the [workspace root](../../) so you can run them with the `compose` recipe:

```bash
just compose
```

Now the PeerPiper wallet is built and composed, and can be used from a Host client, such as the example app:

```
cd examples/svelte-app
npm run build
npm run preview -- --open
```

## Base64 URL Unpadded

The Protocol is to use Base64 URL unpadded strings for bytes arrays.

When passing byte arrays between WebAssembly and JavaScript (and back!) there is a conversion issue between plain Arrays and TypedArrays. To avoid this issue, we convert the byte array to a base64 URL unpadded string. The reason we use Base64Url is so that data can be passed via URL, see [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648).
