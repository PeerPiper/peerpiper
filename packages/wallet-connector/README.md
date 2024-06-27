# PeerPiper Wallet Connector

The code that allows any site to be opened from, thus connect to, any PeerPiper wallet.

## Background

The PeerPiper [Integrity Wallet](../integrity-wallet/README.md) is a [dataurl](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs) based wallet that can be opened any site. This library provides the code that allows any site to be opened from, thus connect to, any PeerPiper wallet.

It essentially uses `window.opener` and `window.postMessage` to communicate with the wallet.

This is safe to use `opener` since the opener is a dataurl, thus a different domain and origin, and the usual security concerns of `window.opener` do not apply.

The PeerPiper Integrity Wallet is also encapsulated in a WebAssembly Component, so no data can exfiltrate from the wallet through this connection. The only thing a client can do it make safe remote procedure call (RPC) requests.

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Everything inside `src/lib` is part of your library, everything inside `src/routes` can be used as a showcase or preview app.

## Building

To build your library:

```bash
npm run package
```

To create a production version of your showcase app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Publishing

Go into the `package.json` and give your package the desired name through the `"name"` option. Also consider adding a `"license"` field and point it to a `LICENSE` file which you can create from a template (one popular option is the [MIT license](https://opensource.org/license/mit/)).

To publish your library to [npm](https://www.npmjs.com):

```bash
npm publish
```
