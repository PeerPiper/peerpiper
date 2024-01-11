# Peerpiper Wallet

An aggregate wallet for Peerpiper made from the following WebAssembly Components:

- [`seed-keeper-wit`](https://github.com/DougAnderson444/seed-keeper/tree/master/crates/seed-keeper-wit)) - To manage the 32 bytes seed
- [`seed-keeper-wit-ui`](https://github.com/DougAnderson444/seed-keeper/tree/master/crates/seed-keeper-wit-ui) - User Interface Engine
- [`delano-wallet`](https://github.com/DougAnderson444/delanocreds/tree/master/crates/delano-wallet) - Delegatable Anonymous Credentials
- [`delano-wit-ui`](https://github.com/DougAnderson444/delanocreds/tree/master/crates/delano-wit-ui)

Future:
- [`recrypted`](https://github.com/DougAnderson444/recrypted) - Transform re-encryption

# Cloning w/ links to external repos via git submodules

This crates uses [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) to link to those external repos. To clone this repo and the submodules use:

```bash
git clone --recurse-submodules
```

If you already cloned the project and forgot `--recurse-submodules`, you can combine the `git submodule init` and `git submodule update` steps by running `git submodule update --init`. To also initialize, fetch and checkout any nested submodules, you can use the foolproof `git submodule update --init --recursive`.

## Updating submodules

```bash
git submodule update --remote
```

## Symlink to wit files

In order to run tests on our aggregate we have made symlinks to the .wit files in ./wit/deps folder. In order to avoid copy-pasting, we can instead symlink the files like this:

```bash
cd wit/deps
ln -s ../../../../../submodules/seed-keeper/crates/seed-keeper-wit-ui/wit/index.wit
```

## Build (Compose)

Ensure that the submodules are built:

```bash
cargo component build --manifest-path=submodules/seed-keeper/Cargo.toml --workspace --release
```

That will makes the `*.wasm` files available to the [`config.yml`](./config.yml).

Next build the wallet itself:

```bash
cd crates/peerpiper-wallet
cargo component build --release
```

Then compose the dependencies into an aggregate wallet, run:

```bash
# from workspace root dir
wasm-tools compose --config crates/peerpiper-wallet/config.yml -o dist/peerpiper_wallet_aggregate.wasm target/wasm32-wasi/release/peerpiper_wallet.wasm
```
