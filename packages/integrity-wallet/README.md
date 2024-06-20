# PeerPiper Intgerity Wallet

The main purpose of this JS package is to host a demo of the PeerPiper Integrity Wallet. The Integrity Wallet is a dataurl wallet where the code integrity to verified via SHA hash as a subresource integrity (SRI).

It also hosts a demo for accessing a PeerPiper desktop node via remote connection.

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
