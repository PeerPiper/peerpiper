<script>
	import { onMount, tick } from 'svelte';
	import { Wurbo, wurboIn } from 'wurbo';

	// When we use $page.url.hash, responding to chnages in the hash becomes very easy.
	import { page } from '$app/stores';

	// Import wasm component bytes as a url
	import wasmURL from '../../../../../dist/peerpiper_wallet_aggregate.wasm?url';
	import peerpiper from '../../../../../crates/peerpiper-browser/Cargo.toml';

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
	let wurbo;

	onMount(async () => {
		const pipernet = await peerpiper();

		// get your wasm bytes from your storage source
		let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());

		// define the import handles you are giving to your component
		let importables = [
			{ 'seed-keeper:wit-ui/wurbo-in': wurboIn },
			{ 'seed-keeper:wallet/wurbo-in': wurboIn },
			{ 'delano:wit-ui/wurbo-in': wurboIn },
			{ 'delano:wallet/wurbo-in': wurboIn },
			{ 'peerpiper:wallet/wurbo-in': wurboIn }
			// { 'example:edwards-ui/wurbo-in': wurboIn },
		];

		// load the import handles into the Wasm component and get the ES module returned
		wurbo = new Wurbo({ arrayBuffer: wasmBytes, importables }, (payload) => {
			// Relay emitted commands from the Wasm component to PiperNet
			// console.log('Command emitted: ', { payload });
			try {
				pipernet.command(payload);
			} catch (error) {
				// it's ok to fail silently, not all messages are commands
			}
		});

		// get the string after the hash (slice 1)
		let api = null;
		try {
			api = $page.url.hash.slice(1);
		} catch (e) {
			console.warn(e);
		}

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
						load: api
					}
				},
				delanoUi: {
					tag: 'all-content',
					// name, version, description
					val: {
						page: {
							name: 'Delano',
							version: '0.0.1',
							description: 'A DAC wallet for the people'
						},
						load: api
					}
				},
				event
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
		renderedHTML = await wurbo.render(data);

		// After the initial data is rendered, then connect to the pipernet:
		// Start peerpiper-server to get a local Multiaddr at port 8080:
		// use try / catch to possibly display "Have you started the server?"
		let res;
		try {
			res = await fetch('http://localhost:8080/');
		} catch (e) {
			console.log('Have you started the server?');
		}

		const dialAddr = await res.text();

		pipernet.connect(dialAddr, (event) => {
			// Relay events from PiperNet to the Wasm component using Wurbo's eventHandler
			// 1) `jco` expects TypedArrays, so we convert the event to Uint8Arrays
			let val = toUint8Arrays(event);
			console.log('Event emitted: ', val);

			// 2) Wrap the event in an event tage so it's compatible witht he expect Context::Event
			let wrapped = { tag: 'event', val };

			// Wrap in Context::Event / Message
			wurbo.eventHandler(wrapped);
		});
	});

	// Once the HTML is rendered and the module is loaded, we can activate the event emitters
	$: if (renderedHTML && wurbo)
		(async () => {
			// wait for the DOM to reflect the updates first
			await tick();
			// once the DOM has our elements loaded, we can activate the event emitters
			wurbo.aggregation();
		})();

	// Helper function which recursively converts any array to uint8array, because `jco` needs TypedArrays
	function toUint8Arrays(obj) {
		if (obj instanceof Array) {
			return new Uint8Array(obj);
		}
		if (obj instanceof Object) {
			for (let key in obj) {
				obj[key] = toUint8Arrays(obj[key]);
			}
		}
		return obj;
	}
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
