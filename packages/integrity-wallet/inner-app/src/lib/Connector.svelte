<!-- A Svelte component that opens a URL in a new tab from an input element -->
<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { handlers } from './index.js';

	/**
	 * DApp URL
	 * @type {string}
	 */
	export let url;

	/**
	 * Reply on the event port
	 * @param {object} r
	 */
	let reply;

	const dispatch = createEventDispatcher();

	// List of origins allowed to send messages to this window
	let origin;

	let openUrl = () => {
		// validate it's a valid url
		const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
		url = new URL(parsedUrl);
		window.open(url, '_blank');
		origin = new URL(url).origin;
	};

	// Listen for messages from the opened window
	const onMessage = (event) => {
		// Only accept messages from the same origin
		if (!origin) {
			console.warn('Received message from unauthorized origin:', event.origin);
			return;
		}
		console.log('Received message from opened window:', event.data);

		const method = event?.data?.method;
		const parameters = event?.data?.params;
		reply = (r) => event.ports[0].postMessage(r);

		dispatch('message', { data: event.data, reply: reply });

		// leaf function to get the value of a nested object
		const leaf = (obj, path) => path.split('.').reduce((value, el) => value && value[el], obj);

		let fn = handlers[method] || leaf(handlers, method);

		reply({ result: `You called ${fn}( ${parameters} )` });
	};

	// Emit the event on the event port
	const handleEmit = (e) => {
		reply({ result: e.detail });
	};
</script>

<svelte:window on:message={onMessage} />

{#if origin}
	<div class="fixed bottom-0 right-0 m-4 p-4 bg-white rounded-lg shadow-lg">
		<h2 class="text-lg font-bold text-gray-800">Connected to {origin}</h2>
		<button
			class="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg"
			on:click={() => (origin = null)}>Disconnect</button
		>
	</div>
	<slot {handleEmit}></slot>
{:else}
	<div class="flex items-center justify-center">
		<div class="bg-white p-8 rounded-lg shadow-lg">
			<h1 class="text-2xl font-bold text-gray-800">
				Connect by opening URL from this Integrity Wallet
			</h1>
			<input
				type="text"
				class="w-full mt-4 p-2 border border-gray-300 rounded-lg"
				bind:value={url}
				on:keydown={(e) => e.key === 'Enter' && openUrl()}
			/>
			<button class="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg" on:click={openUrl}
				>Connect</button
			>
		</div>
	</div>
{/if}
