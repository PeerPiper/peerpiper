# Simple JavaScript Example

Uses `jco` to run a WIT Component that calls handles to the PeerPiper API.

## Usage

```bash
npm install
npm run build
npm run preview
```

Note that due to the way Vite handles dependencies, currently you cannot use `npm run dev` to run this example.

## Howto

Install `jco` from npm:

```bash
npm install @bytecodealliance/jco
```

Use `jco` to `transpile a WIT component to JavaScript:

```js
import { transpile } from 'jco';
```


