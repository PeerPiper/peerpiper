# Peerpiper Wallet

An aggregate wallet for Peerpiper made from the following WebAssembly Components:

- [`seed-keeper`](https://github.com/DougAnderson444/seed-keeper) - To manage the 32 bytes seed
- [`seed-keeper-wit-ui`](https://github.com/DougAnderson444/seed-keeper/tree/master/crates/seed-keeper-wit-ui)
- [`delano-wallet`](https://github.com/DougAnderson444/delanocreds/tree/master/crates/delano-wallet)
- [`delano-wit-ui`](https://github.com/DougAnderson444/delanocreds/tree/master/crates/delano-wit-ui)

Future:
- [`recrypted`](https://github.com/DougAnderson444/recrypted) - Transform re-encryption

# Cloning w/ links to external repos

This crates uses [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) to link to those external repos. To clone this repo and the submodules use:

```bash
git clone --recurse-submodules
```

If you already cloned the project and forgot `--recurse-submodules`, you can combine the `git submodule init` and `git submodule update` steps by running `git submodule update --init`. To also initialize, fetch and checkout any nested submodules, you can use the foolproof `git submodule update --init --recursive`.

## Symlink to wit files

In order to run tests on our aggregate we will need copies of the .wit files in ./wit/deps folder. In order to avoid copy-pasting, we can instead symlink the files.
