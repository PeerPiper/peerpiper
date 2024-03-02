# Simple JavaScript Example

Uses `jco` to run a WIT Component that calls handles to the PeerPiper API.

## Usage

Shortcut: Use [just](https://just.systems) to run the [automated commands](../../justfile):

```bash
just all
```

```bash
npm install
npm run build
npm run preview -- --open
```

(note that `npm run dev` doesn't work due to wasm building wasm, which VIte cannot handle yet)

## Howto

Install `jco` from npm:

```bash
npm install @bytecodealliance/jco
```

Use `jco` to `transpile a WIT component to JavaScript:

```js
import { transpile } from 'jco';
```

## PeerPiper Server

You can start the [`peerpiper-server`](../../crates/peerpiper-server) so that the multiaddr is served on localhost:8080:

From the workspace root:

```bash
cargo run --bin peerpiper-server
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run build
npm run preview -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
