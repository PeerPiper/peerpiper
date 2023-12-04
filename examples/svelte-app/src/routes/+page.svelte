<script>
	import { onMount } from 'svelte';

	// Import wasm wasm component bytes as a url
	import wasmURL from '../../../../target/wasm32-wasi/release/pinger.wasm?url';

	// get imports as a string
	import importables from './importables.js?raw';

	/**
	 * @type {string | null}
	 */
	let whatSayYou = 'Standby, generating your bundle...';
	/**
	 * @type {string}
	 */
	let code = 'Standby, generating your bundle...';

	onMount(async () => {
    const { load } = await import('rollup-plugin-wit-component');

    // Load the wasm component bytes as an array buffer
		let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());

    // Load the wasm component + imports to get the exported module functions
		let mod = await load(/* @vite-ignore */ wasmBytes, importables);

    console.log({ mod });

    whatSayYou = mod.helloWorld('World');

	});
</script>

<svelte:head>
	<title>Rollup Plugin WIT Demo</title>
</svelte:head>

{#if whatSayYou}
	<h1>{whatSayYou}</h1>
{/if}

