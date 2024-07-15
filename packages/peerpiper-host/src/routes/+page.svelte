<script>
	import { ContactBook } from '$lib';
	import { Wallet } from '@peerpiper-wallet';

	function handleEvent(event) {
		console.log('Contact Book Wasm Component emitted an event:', event.detail);
	}
</script>

<svelte:head>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

<Wallet />
<ContactBook on:event={handleEvent} />
