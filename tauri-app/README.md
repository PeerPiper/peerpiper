# PeerPiper Desktop

True Native DWeb:

- [x] Connect to your own node from home, web, or mobile (libp2peasy + WebRTC)
- [x] Store your data to your own device (Tauri)
- [x] Remotely run Large Language Models (LLMs) privately on your own device

## Tech Stack

The power of a native app for desktop and mobile, built with:

- [x] Tauri
- [x] Svelte-Kit and Vite
- [x] TailwindCSS

## Stretch Goals

- [ ] Save your Web3 data to your devices or the network
- [ ] [Plugins](https://component-model.bytecodealliance.org/) of your choice

## Build Targets

- [x] Linux
- [ ] MacOS
- [ ] Windows
- [x] Android (Via web browser to your node runnign at home)
- [x] iOS (Via web browser to your node running at home)

## Development

The command `npm run dev:tauri` will run Svelte first which will start the vite dev server. Then it will compile the rust code, and start the Tauri dev server:

```bash
npm run tauri dev
# or using just.systems:
just tauri
```
