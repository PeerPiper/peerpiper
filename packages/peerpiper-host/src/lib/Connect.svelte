<script>
	// Connects to a PeerPiper node
	import { onMount } from 'svelte';
	// import peerpiper from '../../../../crates/peerpiper-browser/Cargo.toml';
	import * as peerpiper from '@peerpiper/peerpiper-browser';

	/**
	 * The address of the peer to connect to
	 * @type {string[]}
	 */
	export let dialAddrs = [];

	/** @type {string|null} */
	let errorConnecting = null;
	let connectingState = 'idle';

	/** @type {peerpiper.PeerPiper} */
	let piper;

	onMount(async () => {
		try {
			await peerpiper.default();
			let promise = new peerpiper.PeerPiper('peerpiper-host');
			piper = await promise;
		} catch (error) {
			console.error(error);
			errorConnecting = error;
			connectingState = 'error';
		}
	});

	// When the user input Enters the dialAddr, we will connect to the peer using connect
	function handleConnect(evt) {
		connectingState = 'connecting...';

		// handle events
		const onEvent = async (evt) => {
			console.log('Event Happened:', evt);
		};

		try {
			console.log('Connecting to', dialAddrs);
			piper.connect(dialAddrs, onEvent);
			connectingState = 'connected';
		} catch (error) {
			console.error(error);
			errorConnecting = error;
		}
	}
</script>

<div class="flex flex-col items-center justify-start h-full w-full p-4">
	<h1 class="text-3xl font-bold mb-4">PeerPiper Remote Connect</h1>
	<div class="flex text-lg text-left w-full break-all">
		<div class="flex flex-col">
			<div class="font-semibold mb-4">Connect to a Peer using this address:</div>
			<!-- show each of the dialAddrs  -->
			{#each dialAddrs as dialAddr}
				<div class="flex flex-col">
					<div class="text-lg">{dialAddr}</div>
				</div>
			{/each}
			<button
				class="mt-2 p-2 text-white font-semibold rounded"
				class:disabled={connectingState === 'connecting...'}
				class:bg-slate-500={connectingState === 'connecting...'}
				class:bg-green-500={connectingState === 'connected'}
				class:bg-blue-500={connectingState === 'idle'}
				on:click={handleConnect}
			>
				<!-- Use connectingState to manage the text and disableness of this button -->
				{#if connectingState === 'connecting...'}
					Connecting...
				{:else if connectingState === 'connected'}
					Connected
				{:else}
					Connect
				{/if}
			</button>
			{#if errorConnecting}
				<div class="text-red-500 mt-2">{errorConnecting}</div>
			{/if}
		</div>
	</div>
</div>
