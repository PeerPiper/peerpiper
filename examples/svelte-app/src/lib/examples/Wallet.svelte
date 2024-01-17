<script>
	import { onMount, tick } from 'svelte';
	import * as wurbo from 'wurbo';

	// Import wasm component bytes as a url
	import wasmURL from '../../../../../dist/peerpiper_wallet_aggregate.wasm?url';
	import { importables } from '$lib';

	/**
	 * The rendered component as a string of HTML
	 * @type {string | null}
	 */
	let renderedHTML;
	/**
	 * The module that loads the WebAssembly component
	 *
	 * @type {{ render: (arg0: string) => string | null; listen: () => void; }}
	 */
	let mod;

	onMount(async () => {
		// ensure you are in the Browser environment to rollup your WIT Component
		const { load } = await import('rollup-plugin-wit-component');

		let listener = new wurbo.Listener();

		// get your wasm bytes from your storage source
		let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());

		// define the import handles you are giving to your component
		let all_importables = [
			{ 'seed-keeper:wit-ui/wurbo-in': importables.buildCodeString(listener.namespace) },
			{ 'seed-keeper:wallet/wurbo-in': importables.buildCodeString(listener.namespace) },
			{ 'delano:wit-ui/wurbo-in': importables.buildCodeString(listener.namespace) },
			{ 'delano:wallet/wurbo-in': importables.buildCodeString(listener.namespace) },
			{ 'peerpiper:wallet/wurbo-in': importables.buildCodeString(listener.namespace) }
			// { 'example:edwards-ui/wurbo-in': importables.buildCodeString(listener.namespace) },
		];

		// load the import handles into the Wasm component and get the ES module returned
		mod = await load(wasmBytes, all_importables);

		// call `render` with your inputs for the component
		let data = {
			tag: 'all-content',
			val: {
				app: {
					title: 'Aggregated Wasm User Interfaces'
				},
				seedUi: {
					tag: 'all-content',
					val: {
						page: {
							title: 'UI #1: A Seed Keeper'
						},
						input: {
							placeholder: 'Your Username (pick any 8+ chars)'
						},
						output: null
					}
				},
				delanoUi: {
					tag: 'all-content',
					// name, version, description
					val: {
						page: {
							name: 'Delano',
							version: '0.0.1',
							description: 'A wallet for the people'
						}
					}
				}
				// edwardsUi: {
				// 	tag: 'all-content',
				// 	val: {
				// 		page: {
				// 			title: 'UI #2: An Edwards25519 Signer'
				// 		},
				// 		input: {
				// 			placeholder: 'a message to sign'
				// 		},
				// 		output: null
				// 	}
				// }
			}
		};
		renderedHTML = mod.wurboOut.render(data);

		// lisen for events from the component
		listener.listen(mod);

		// Set up a broadcast channel to listen for updates from the Blob URLs
		const bc = new BroadcastChannel(listener.namespace);

		// Listen for messages from the Blob URLs
		bc.onmessage = (event) => {
			// console.log('Svelte BroadcastChannel evt', { event });
		};
	});

	// Once the HTML is rendered and the module is loaded, we can activate the event emitters
	$: if (renderedHTML && mod)
		(async () => {
			// wait for the DOM to reflect the updates first
			await tick();
			// once the DOM has our elements loaded, we can activate the event emitters
			// mod.wurboOut.activate();
			console.log({ mod });
			mod.aggregation.activates();
			console.log('events activated');
		})();
</script>

<svelte:head>
	<title>Seed Keeper</title>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>
<div>
	<h1>Aggregate User Interfaces</h1>
	{#if renderedHTML}
		{@html renderedHTML}
	{/if}
</div>
