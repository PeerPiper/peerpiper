import "./style.css";
import javascriptLogo from "./javascript.svg";
import peerpiperLogo from "/peerpiper.svg";
import { setupCounter } from "./counter.js";

import { load } from "rollup-plugin-wit-component";

// Import wasm wasm component bytes as a url
import wasmURL from '../../target/wasm32-wasi/release/pinger.wasm?url';

// get imports as a string
import importables from "./importables.js?raw";

let importName = "./importables.js";

async function loadWasm() {
  const { load } = await import('rollup-plugin-wit-component');

  // Load the wasm component bytes as an array buffer
	let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());

  let mod = await load(/* @vite-ignore */ wasmBytes, importables);

  console.log({ mod });

  let whatSayYou = mod.helloWorld('World');
  document.body.innerHTML = `<h1>${whatSayYou}</h1> from Vite`;
}

loadWasm();
