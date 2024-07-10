<script>
	import Wallet from './lib/Wallet.svelte';
	import Connector from './lib/Connector.svelte';

	// take the location.hash.slice(1) and process t into searchParams, pass the object to Connector
	let searchParams = new URLSearchParams(location.hash.slice(1));
	let url = searchParams.get('dapp');

	let delanoUi = null;

	function handleMessage(event) {
		const { data, reply } = event.detail;
		console.log('Received message from Connector:', event.detail);
		if (data.method === 'delanocreds.sign') {
			delanoUi = {
				tag: 'all-content',
				val: {
					load: data.params
				}
			};
			reply({ result: 'Delano UI received' });
		}
	}
</script>

<!-- add https://cdn.jsdelivr.net/npm/tailwindcss/dist/tailwind.min.css-->
<svelte:head>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

<main>
	<Connector {url} let:handleEmit on:message={handleMessage}>
		<Wallet on:emit={handleEmit} {delanoUi} />
	</Connector>
</main>
