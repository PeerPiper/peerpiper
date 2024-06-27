<script>
	import Wallet from './lib/Wallet.svelte';
	import Connector from './lib/Connector.svelte';

	// take the location.hash.slice(1) and process t into searchParams, pass the object to Connector
	let searchParams = new URLSearchParams(location.hash.slice(1));
	let url = searchParams.get('dapp');
</script>

<main>
	<Wallet />
	<Connector {url} />
</main>
