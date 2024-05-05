<script>
	import { onMount, tick } from 'svelte';
	import { Wurbo, wurboIn } from 'wurbo';

	// When we use $page.url.hash, responding to chnages in the hash becomes very easy.
	import { page } from '$app/stores';

	// Import wasm component bytes as a url
	// import wasmURL from '../../../../../target/wasm32-wasi/debug/form.wasm?url';

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
		// get your wasm bytes from your storage source
		let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());

		// define the import handles you are giving to your component
		let importables = [{ 'demo:form/wurbo-in': wurboIn }];

		// load the import handles into the Wasm component and get the ES module returned
		wurbo = new Wurbo({ arrayBuffer: wasmBytes, importables }, (payload) => {
			// Relay emitted events as desired
			console.log('Component event emitted: ', { payload });
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
				revenue: 100,
				expenses: 20
			}
		};
		renderedHTML = await wurbo.render(data);
	});

	// Once the HTML is rendered and the module is loaded, we can activate the event emitters
	$: if (renderedHTML && wurbo)
		(async () => {
			// wait for the DOM to reflect the updates first
			await tick();
			// once the DOM has our elements loaded, we can activate the aggregated event emitters
			wurbo.activate();
		})();
</script>

<svelte:head>
	<title>Demo Form</title>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>
<div>
	{#if renderedHTML}
		{@html renderedHTML}
	{/if}
</div>
