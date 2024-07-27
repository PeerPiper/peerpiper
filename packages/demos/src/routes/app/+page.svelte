<script>
	import { onMount, tick, createEventDispatcher } from 'svelte';
	import ContactBook from './ContactBook.svelte';

	// Handle the invite
	function handleInvite(event) {
		console.log('ContactBook Event:', event.detail);
	}
</script>

<svelte:head>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

<ContactBook on:event={handleInvite} />
