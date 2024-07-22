<script>
	import { onMount } from 'svelte';
	import { ContactBook, Modal, Details, Connect } from '$lib';
	import { Wallet } from '@peerpiper-wallet';
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/stores';

	let connected = false;

	let api;

	let contactBookData;

	// the Dial Address to connect to
	let dialAddr;

	onMount(async () => {
		// Start peerpiper-server to get a local Multiaddr at port 8080:
		// use try / catch to possibly display "Have you started the server?"
		try {
			const res = await fetch('http://localhost:8080/');
			console.log('res', res);
			const addr = await res.text();
			dialAddr = addr;
		} catch (e) {
			console.log('Have you started the server?');
		}
	});

	const variants = {
		INVITE: 'invite'
	};

	function handleVariant(variant) {
		switch (variant) {
			case variants.INVITE:
				return 'Invite';
			default:
				return 'Invite';
		}
	}

	async function handleContactBookEvt(event) {
		const evt = event.detail;

		if (evt?.tag == 'invite') {
			const state = { showWallet: true };
			pushState('', state);
			const invited = await api.invite(evt.val);
			console.log('Invited', invited);
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
		} else {
			console.log('Not inviting', evt);
		}
	}

	function handleConnected(event) {
		$page.state.showWallet = false;
		connected = true;
	}

	// Handle invited means: hide wallet, save publishKey to appropriate contact id in ContactBook
	function handleInvited(event) {
		const { id, publishKey } = event.detail;
		$page.state.showWallet = false;
		console.log('Invited', id, publishKey);
		contactBookData = {
			tag: 'updatecontact',
			val: { id, vals: [{ label: 'publishingKey', value: publishKey }] }
		};
	}
</script>

<svelte:head>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

{#if dialAddr}
	<Connect {dialAddr} />
{/if}

<ContactBook on:event={handleContactBookEvt} data={contactBookData} />
<hr />
<!-- <Details title={'Wallet'}> -->
<Wallet on:unlock={handleConnected} on:invited={handleInvited} bind:api />
<!-- </Details> -->
