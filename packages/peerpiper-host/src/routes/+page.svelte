<script>
	import { onMount } from 'svelte';
	import { ContactBook, Modal, Details, Connect } from '$lib';
	import { Wallet } from '@peerpiper-wallet';
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolveDnsaddr } from '$lib/utils/resolveDns.js';

	// An in-memory store of accepted credentials and their corresponding attribute preimages
	const accepted = new Map();

	// when hash changes, undo the url.hash = btoa(JSON.stringify({ offer, hints })); which created it
	$: if ($page.url.hash && walletApi) {
		const parsed = JSON.parse(atob($page.url.hash.slice(1)));
		// console.log('parsed', parsed);
		if (parsed.offer) {
			walletApi.accept(parsed).then((res) => {
				console.log('Accepted offer verified', res);
				const { credential, preimages } = res;
				accepted.set(credential, preimages);
			});
		}
		// goto('/+page');
	}

	let connected = false;

	// How we access the wallet functions
	let walletApi;

	let contactBookData;

	// the Dial Address to connect to
	let dialAddrs = [];

	onMount(async () => {
		// Start peerpiper-server to get a local Multiaddr at port 8080:
		// use try / catch to possibly display "Have you started the server?"
		try {
			const res = await fetch('http://localhost:8080/');
			console.log('res', res);
			const addr = await res.text();
			dialAddrs = [addr];
		} catch (e) {
			console.log('Have you started the server? Using bootstrap.libp2p.io instead.');

			let libp2pBootstrapDns = '/dnsaddr/bootstrap.libp2p.io';
			let libp2pBootstrapDnsaddr = await resolveDnsaddr(libp2pBootstrapDns);
			dialAddrs = [libp2pBootstrapDnsaddr];
		}
	});

	const variants = {
		INVITE: 'invite',
		PROFILE: 'profile'
	};

	async function handleContactBookEvt(event) {
		const evt = event.detail;

		switch (evt.tag) {
			case variants.PROFILE:
				console.log('Profile', evt.val);
				// TODO: publish profile details to "the network"
				break;
			case variants.INVITE:
				const state = { showWallet: true };
				pushState('', state);
				const invited = await walletApi.invite(evt.val);
				// send the publishingKey to the contact
				contactBookData = {
					tag: 'updatecontact',
					val: {
						id: evt.val.id,
						vals: [
							{
								tag: 'publishing-key',
								val: invited.publishingKey
							}
						]
					}
				};
				break;
			default:
				console.log('Nothing to see ehre', evt);
		}
	}

	function handleConnected(event) {
		console.log('Connected', event.detail);
		$page.state.showWallet = false;
		connected = true;
	}
</script>

<svelte:head>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

{#if dialAddrs}
	<Connect {dialAddrs} />
{/if}
<ContactBook on:event={handleContactBookEvt} data={contactBookData} />
<hr />
<!-- <Details title={'Wallet'}> -->
<Wallet on:unlock={handleConnected} bind:api={walletApi} />
<!-- </Details> -->
