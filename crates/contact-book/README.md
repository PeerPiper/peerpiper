# Contact Book

A basic Contact Book which is compatible with PeerPiper API, meaning it can emit contact invites which can be imported into the PeerPiper Wallet for signing.

Designed as a [WIT component]() so it can be trustlessly used, customized or even upgraded/replaced with another implementation seemlessly for zero lock-in.

Contacts can be imported and are also emitted so they can be stored in your data location of choice.

## Build

```bash
cargo component build --release
```

## Customize HTML Front-end

[`Wurbo`](https://github.com/DougAnderson444/wurbo) is designed using [`minijinja`](https://github.com/mitsuhiko/minijinja) to allow for easy customization of the HTML front-end. To use custom templates, simply edit the files in the [templates](./demo/src/libtemplates/) folder when using the [WIT component](https://component-model.bytecodealliance.org/introduction.html).
