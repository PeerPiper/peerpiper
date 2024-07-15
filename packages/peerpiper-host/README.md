# Complete PeerPiper Host

PeerPiper Host as a SveteKit app.

PeerPiper takes a different approach when it comes to decentralized apps. The trust model is built around the [WebAssembly Component Model](https://component-model.bytecodealliance.org/), where users only have to audit or trust the host app runner. This way, a host can run any number of Wasm Apps (WApps) trustlessly, or one can seemlessly build their own Host and run those same WApps.

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
