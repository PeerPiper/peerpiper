<script>
	import { onMount } from 'svelte';
	import { connect } from '@peerpiper/wallet-connector';

	let remote;

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
			<a href="http://localhost:4175/integrity-wallet?{params}" target="_blank" class="">
				<p class="rounded bg-sky-500 px-4 py-2 w-fit shadow text-white font-semibold">
					Click to Connect
				</p>
			</a>
		{/if}
	</div>
</main>
