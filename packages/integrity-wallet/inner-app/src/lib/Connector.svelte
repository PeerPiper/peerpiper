<!-- A Svelte component that opens a URL in a new tab from an input element -->
<script>
	import { onMount, createEventDispatcher } from 'svelte';

	/**
	 * DApp URL
	 * @type {string}
	 */
	export let url;

	const dispatch = createEventDispatcher();

	// List of origins allowed to send messages to this window
	let origins = new Set();

	let openUrl = () => {
		// validate it's a valid url
		if (!url.startsWith('http')) {
			return;
		}
		window.open(url, '_blank');
		console.log('URL opened:', url);
		origins.add(new URL(url).origin);
		origins = origins;
		console.log('Origins:', origins);
	};

	// Listen for messages from the opened window
	const onMessage = (event) => {
		// Only accept messages from the same origin
		if (!origins.has(event.origin)) {
			console.warn('Received message from unauthorized origin:', event.origin);
			return;
		}
		console.log('Received message from opened window:', event.data);
		// get the transferred port and repond with "We're here!"
		event.ports[0].postMessage({ result: "We're here!" });
	};
</script>

<svelte:window on:message={onMessage} />

<!-- An input element that opens a target _blank when Enter pressed or COnnect button clicked. Tailwindcss. -->
<!-- uses href with target="_blank" and goes to the URL -->
<div class="flex items-center justify-center h-screen">
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

<!--Displays set of origins -->
{#if origins.size > 0}
	<div class="fixed bottom-0 right-0 m-4 p-4 bg-white rounded-lg shadow-lg">
		<h2 class="text-lg font-bold text-gray-800">Auth'd Origins</h2>
		<ul class="mt-2">
			{#each Array.from(origins) as origin}
				<li class="text-sm text-gray-600">{origin}</li>
			{/each}
		</ul>
	</div>
{/if}
