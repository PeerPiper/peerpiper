<script>
	import { onMount } from 'svelte';
	import { connect } from '@peerpiper/wallet-connector';

	let remote;
	let walletUrl = 'http://localhost:4175/integrity-wallet';

	onMount(async () => {
		let method = 'sign';
		let params = 'data';
		remote = connect();
		console.log('remote', { remote });
		if (remote) {
			let resp = await remote.delanocreds.sign(params);
			console.log('response', { resp });
		} else {
			console.log('Remote not connected');
		}
	});

	let params = new URLSearchParams({
		dapp: window.location.href
	}).toString();

	function handleSign(e) {
		console.log('Sending invite for signature', e.detail);
		remote.delanocreds.sign(e.detail).then((resp) => {
			console.log('Response from signature', resp);
		});
	}
</script>

<main class="p-2">
	<h1 class="font-semibold text-2xl">Demo App on Wallet Usage</h1>
	<!-- TEST if remote connected (or not) and leave msg accordingly -->
	<div class="p-2">
		{#if remote}
			<p class="bg-green-100 my-4 p-2 rounded w-full text-green-500">Connected to Signer</p>
			<!-- slot component can emit an event called sign -->
			<slot {handleSign} />
		{:else}
			<div class="bg-red-100 my-4 p-2 rounded w-full text-red-500">Not Connected!</div>
			<div class="flex flex-row">
				<input
					type="text"
					bind:value={walletUrl}
					class="flex-1 px-2 border border-gray-300 rounded w-full mr-4"
				/>
				<a
					href="http://localhost:4175/integrity-wallet?{params}"
					target="_blank"
					class="flex-initial"
				>
					<p class="rounded bg-sky-500 px-4 py-2 shadow text-white font-semibold">Connect</p>
				</a>
			</div>
		{/if}
	</div>
</main>
