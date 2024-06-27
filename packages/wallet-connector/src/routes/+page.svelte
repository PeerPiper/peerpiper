<script>
	import { connect } from '@peerpiper/wallet-connector';
	import { onMount } from 'svelte';
	let rpc;
	onMount(async () => {
		let method = 'sign';
		let params = 'data';
		rpc = connect();
		if (rpc) {
			let resp = await rpc({ method, params });
			console.log('response', { resp });
		} else {
			console.log('RPC not connected');
		}
	});

	let params = new URLSearchParams({
		dapp: window.location.href
	}).toString();
</script>

<main class="p-2">
	<h1 class="font-semibold text-2xl">Demo App on Wallet Usage</h1>
	<!-- TEST if rpc connected (or not) and leave msg accordingly -->
	<div class="p-2">
		{#if rpc}
			<p class="bg-green-100 my-4 p-2 rounded w-full text-green-500">Connected!</p>
		{:else}
			<div class="bg-red-100 my-4 p-2 rounded w-full text-red-500">Not Connected!</div>
			<a href="http://localhost:4175/integrity-wallet?{params}" target="_blank" class="">
				<p class="rounded bg-sky-500 px-4 py-2 w-fit shadow text-white font-semibold">
					Click to Connect
				</p>
			</a>
		{/if}
	</div>
</main>
