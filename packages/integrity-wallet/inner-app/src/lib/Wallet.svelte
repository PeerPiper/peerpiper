<script>
	import { onMount, tick, createEventDispatcher } from 'svelte';
	import { Wurbo, wurboIn } from 'wurbo';

	// Import wasm component bytes as a url
	import wasmURL from '../../../../../dist/peerpiper_wallet_aggregate.wasm?url';
	// import wasmURL from 'https://github.com/PeerPiper/peerpiper/releases/download/prerelease/peerpiper_wallet_aggregate.wasm?url';

	export let delanoUi;

	let delanoUiDefault = {
		tag: 'all-content',
		// name, version, description
		val: {
			page: {
				name: 'Delano',
				version: '0.0.1',
				description: 'A DAC wallet for the people'
			},
			load: null
		}
	};

	let data;

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

	/**
	 * The event dispatcher for the component
	 * @type {function}
	 */
	const dispatch = createEventDispatcher();

	onMount(async () => {
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
		// We inline the worker code because it's built into a dataurl in this app
		let inline = true;
		wurbo = new Wurbo({ arrayBuffer: wasmBytes, importables, inline }, async (payload) => {
			// Relay emitted commands from the Wasm component to PiperNet
			console.log('Command emitted: ', { payload });
			dispatch('emit', payload);
		});

		// get the string after the hash (slice 1)
		let api = null;
		try {
			const searchParams = new URLSearchParams(location.hash.slice(1));
			api = JSON.stringify(Object.fromEntries(searchParams.entries()));
		} catch (e) {
			console.warn(e);
		}

		// call `render` with your inputs for the component
		data = {
			tag: 'all-content',
			val: {
				app: {
					title: 'PeerPiper Wallet'
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
						...delanoUiDefault.val.page,
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
		console.log('data', { data });
		renderAndUpdate(data);
	});

	function renderAndUpdate(val) {
		console.log('renderAndUpdate', { val });
		wurbo.render(val).then((html) => {
			renderedHTML = html;
			tick().then(() => {
				wurbo.aggregation();
			});
		});
	}

	$: if (wurbo && delanoUi) {
		console.log('delanoUi', { delanoUi });
		// renderAndUpdate(delanoUi);
	}
</script>

<svelte:head>
	<title>PeerPiper Wallet</title>
</svelte:head>
<div>
	{#if renderedHTML}
		{@html renderedHTML}
	{/if}
</div>
