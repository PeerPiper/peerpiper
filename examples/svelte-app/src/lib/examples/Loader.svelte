<script>
	// a component to send data to a plugin
	import { onMount, tick, createEventDispatcher } from 'svelte';
	import peerpiper from '../../../../../crates/peerpiper-browser/Cargo.toml';
	import { Wurbo, wurboIn } from 'wurbo';

	export let pluginFile;

	const files = new Map();
	let fileinput;
	let name;
	let piper;

	const dispatch = createEventDispatcher();
	/**
	 * The rendered component as a string of HTML
	 * @type {string | null}
	 */
	let renderedHTML;
	/**
	 * The module that loads the WebAssembly component
	 *
	 * @type
	 */
	let wurbo;

	let Graph = null;

	onMount(async () => {
		piper = await peerpiper();

		// init the graph utility
		const g = await import('./graph/graph.js');
		console.log('g', g);
		g.$init.then(() => (Graph = new g.provider.Graph()));
	});

	// this fires when todos change; let's emit an event to update any listeners consuming this component
	$: if (pluginFile && piper) {
		// name without the .wasm on the end, because we will also store our data here
		let path = ['apps', pluginFile.name.replace(/\.wasm$/, ''), 'wasm'];
		console.log('path', path);
		(async () => {
			try {
				let bytesString = Array.from(new Uint8Array(pluginFile.bytes)).join(',');
				let command = `{ "System": { "Put": { "bytes": [${bytesString}] } } }`;
				// TODO: Figure out why the Errors don't propagate back up here. It gets stuck in wasm-bindgen
				let res = await piper.command(command);
				console.log('command result', res);
				load(res);

				pluginFile = null; // reset loader state
				fileinput.value = null; // reset file input
			} catch (error) {
				console.error('error saving plugin', { error });
			}
		})();
	}

	const onFileSelected = (e) => {
		let plugin = e.target.files[0];
		let reader = new FileReader();

		files.set(reader, plugin);

		reader.addEventListener('loadend', (evt) => {
			console.log('reader.result', { reader }, { evt });
			// reader.result contains the contents of blob as a typed array
			pluginFile = { bytes: reader.result, name };
		});

		reader.addEventListener('load', (evt) => {
			const file = files.get(evt.target);
			console.log(`The contents of ${file.name}:`);
			name = file.name;
		});

		// reader.readAsDataURL(plugin);
		reader.readAsArrayBuffer(plugin);
		// reader.readAsText(plugin);
	};

	// OnFileLoaded: Once the wasm bytes are loaded, we can setup the plugin
	// key is a cid string
	async function load(cid) {
		// get bytes from piper command using Get
		let command = `{ "System": { "Get": { "key": "${cid}" } } }`;
		let res = await piper.command(command);

		// setup the plugin
		// turn the result bytes into an array buffer
		let bytes = new Uint8Array(res);
		let arrayBuffer = bytes.buffer;

		// use Graph to get the importables from the bytes
		let imports;
		try {
			let component = Graph.addComponent('loaded', bytes);
			console.log('component', component);
			imports = component.imports;
		} catch (error) {
			console.error('error getting importables', { error });
		}

		// filter to select any that contains `/wurbo-in`, set the importable to the `wurboIn` function,
		let importables = imports
			.filter((i) => i.name.includes('/wurbo-in'))
			.map((i) => {
				// trim string after the @
				let name = i.name.split('@')[0];
				return { [name]: wurboIn };
			});

		console.log({ importables });

		// load the import handles into the Wasm component and get the ES module returned
		wurbo = new Wurbo({ arrayBuffer, importables }, async (payload) => {
			// Relay emitted commands from the Wasm component to PiperNet
			console.log('Command emitted: ', { payload });
			try {
				return await piper.command(payload);
			} catch (error) {
				// it's ok to fail silently, not all messages are commands
			}
		});

		// call `render` with your inputs for the component
		renderedHTML = await wurbo.render({
			tag: 'all-content',
			val: {}
		});
	}

	// Once the HTML is rendered and the module is loaded, we can activate the event emitters
	$: if (renderedHTML && wurbo)
		(async () => {
			// wait for the DOM to reflect the updates first
			await tick();
			// once the DOM has our elements loaded, we can activate the aggregated event emitters
			wurbo.activate();
		})();
</script>

<input
	style="display:none"
	type="file"
	accept=".wasm, .wasm"
	on:change={(e) => onFileSelected(e)}
	bind:this={fileinput}
/>
<div
	class="flex justify-center cursor-pointer border border-green-400 rounded-md px-4 py-2 my-1 shadow"
	on:keypress={() => {
		fileinput.click();
	}}
	on:click={() => {
		fileinput.click();
	}}
>
	<div class="flex">
		Load wurbo *.wasm file (must export <span class="font-mono mx-1 px-1 bg-amber-100 rounded-lg"
			>wurbo-in</span
		>
		and import
		<span class="font-mono mx-1 px-1 bg-amber-100 rounded-lg">wurbo-out</span>
		)
	</div>
</div>

<!-- Display bytes -->
{#if pluginFile}
	<div class="flex flex-col">
		<div class="flex-1 flex-row bg-green-50/10 p-2">File loaded</div>
		<div class="flex-1 flex-row">{@html pluginFile}</div>
	</div>
{/if}

<div>
	{#if renderedHTML}
		{@html renderedHTML}
	{/if}
</div>
