<script>
	import { Connector } from '@peerpiper/wallet-connector';
	import { default as Create } from '$lib/contacts/Create.svelte';
</script>

<Connector let:handleSign>
	<Create on:sign={handleSign} />
</Connector>
