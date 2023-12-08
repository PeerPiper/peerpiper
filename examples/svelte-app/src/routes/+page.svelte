<script>
	import { onMount, tick } from 'svelte';
	import * as wurbo from 'wurbo';

	// Import wasm wasm component bytes as a url
	import wasmURL from '../../../../target/wasm32-wasi/release/pinger.wasm?url';

	// get imports as a string
	import importableCode from './importables.js?raw';
	import wurboHandles from './wurboHandles.js?raw';

	/**
	 * @type {string | null}
	 */
	let renderedHTML = 'Standby, generating your bundle...';
	/**
	 * The module that loads the WebAssembly component
	 *
	 * @type {{ render: (arg0: string) => string | null; listen: () => void; }}
	 */
	let mod;

	onMount(async () => {
		const { load } = await import('rollup-plugin-wit-component');

		// Load the wasm component bytes as an array buffer
		let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());

		// define the import handles you are giving to your component
		let importables = [
			{ 'peerpiper:pinger/eventerface': wurboHandles },
			{ 'peerpiper:pinger/imports': importableCode }
		];

		// Load the wasm component + imports to get the exported module functions
		mod = await load(/* @vite-ignore */ wasmBytes, importables);

		console.log({ mod: mod.reactivity });

		renderedHTML = mod.reactivity.render('World');

		// lisen for events from the component
		wurbo.listen(mod);
		console.log('listening');
	});

	$: if (renderedHTML) console.log('renderedHTML GTG', renderedHTML);
	$: if (mod) console.log('mod GTG', mod);

	// Once the HTML is rendered and the module is loaded, we can activate the event emitters
	$: if (renderedHTML && mod)
		(async () => {
			// wait for the DOM to reflect the updates first
			await tick();
			console.log('activating');
			// once the DOM has our elements loaded, we can activate the event emitters
			mod.reactivity.activate();
		})();
</script>

<svelte:head>
	<title>Rollup Plugin WIT Demo</title>
</svelte:head>

{#if renderedHTML}
	<h1>{@html renderedHTML}</h1>
{/if}
