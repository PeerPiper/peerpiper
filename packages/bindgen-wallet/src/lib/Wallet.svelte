<script>
	// @hmr:keep-all
	// All state in this component will be preserved during hot reload
	import { onMount, setContext, createEventDispatcher } from 'svelte';
	import { Seed, Invite, Header } from './index.js';
	import { page } from '$app/stores';
	import OfferClipboard from './components/OfferClipboard.svelte';
	import AcceptOffer from './components/AcceptOffer.svelte';

	import wasm from '../../../../crates/peerpiper-wasm-bindgen/Cargo.toml';

	const dispatch = createEventDispatcher();

	let unlock, wallet, generateAttribute, getPublishKey;
	let error;
	let b64Seed;
	let hash;
	let offer, hints;
	let verified;

	let activeComponent = null;
	let activeProps = {};
	let handleActiveEvt;

	let inviteResolve;

	const KEY_BASE64_SEED = 'encrypted_seed_base64';

	async function loadWasm() {
		if (!import.meta.env.SSR) {
			// This code will only run in the browser
			const exports = await wasm();

			// Use functions which were exported from Rust...
			return { ...exports };
		}
	}

	export let api = {
		invite,
		accept,
		extend
	};

	// Function invite takes contact info, prompts to generate offer, then returns the publishingKey and hints
	async function invite(attributes) {
		// set active component to Invite
		// wait on invite event
		// handle invite, return publishingKey and hints
		let attrs = Object.entries(attributes)
			.filter(([key, value]) => value && key != 'id')
			.map(([key, value]) => ({ key, value }));
		activeComponent = Invite;
		activeProps = { attributes: attrs };
		handleActiveEvt = handleInvite;

		return new Promise((resolve, reject) => {
			inviteResolve = resolve;
		});
	}

	// Function accept takes offer and hints, prompts to accept offer, then returns the verified status
	async function accept({ offer, hints }) {
		// set active component to AcceptOffer
		// wait on accept event
		// handle accept, return verified status
		console.log('[Wallet]: Accepting offer', { offer, hints });
		activeComponent = AcceptOffer;
		activeProps = { hash: { offer, hints } };

		return new Promise((resolve, reject) => {
			handleActiveEvt = (event) => {
				const attributes = hashAttrs(event.detail);
				const acceptedCred = wallet.accept(offer);

				// To validate that we entered the answers correctly, we need to do a test proof and verification

				// generate random nonce, fill a Uint8Array with random values
				let nonce = new Uint8Array(32);
				window.crypto.getRandomValues(nonce);

				let provables = {
					credential: acceptedCred,
					entries: [attributes],
					selected: attributes,
					nonce
				};

				// Now we can create a proof
				try {
					let { proof, selected } = wallet.prove(provables);

					// Now we can verify the proof against the issuer's public data and the selected attributes
					let verifiables = {
						proof,
						issuer_public: acceptedCred.issuer_public,
						selected,
						nonce
					};

					let verified = wallet.verify(verifiables);

					if (verified) {
						console.log('Verified');
					} else {
						console.warn('Not Verified');
					}

					resolve({
						credential: acceptedCred,
						preimages: event.detail
					});
				} catch (e) {
					console.error(e);
					reject(e);
				}
			};
		});
	}

	// Function extends a credential with an additional attribute, returns the updated credential
	function extend(credential, attribute) {
		// set active component to Extend
		// wait on extend event
		// handle extend, return updated credential
	}

	// handleHashChange
	function handleHashChange() {
		console.log('hash change', window.location.hash);
		if (window.location.hash) {
			hash = JSON.parse(window.atob(window.location.hash.slice(1)));
		}
	}

	onMount(async () => {
		const { WasmWallet, attribute, publishKey } = await loadWasm();

		getPublishKey = publishKey;

		// check for b64seed in local storage
		b64Seed = localStorage.getItem(KEY_BASE64_SEED);

		// if hash,
		// get any #hash value, atob it, and parse it into JSON
		if (window.location.hash) hash = JSON.parse(window.atob(window.location.hash.slice(1)));

		unlock = async (e) => {
			try {
				wallet = new WasmWallet(e.detail);
				let encrSeed = wallet.encryptedSeed();
				// to Uint8Array, to base64 string
				let seed = new Uint8Array(encrSeed);
				b64Seed = btoa(String.fromCharCode(...seed));
				localStorage.setItem(KEY_BASE64_SEED, b64Seed);

				dispatch('unlock', { encryptedSeed: encrSeed, base64Seed: b64Seed });
			} catch (e) {
				error = e;
			}
		};

		generateAttribute = attribute;

		// Now we can create an attribute from Uint8Array
		let myAttribute = attribute(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
	});

	// serialize the attributes into a Uint8Array Preimage
	function preimageFromAttribute({ key, value }) {
		// create string of `key = value`, except for Uint8Array or ArrayBuffer
		if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
			return value;
		}
		let val = `${key} = ${value}`;
		// convert string to bytes
		return new TextEncoder().encode(val);
	}

	// Preprocesses the string into proper Attributes
	function hashAttrs(attributes) {
		return attributes.map(({ key, value }) => {
			return generateAttribute(preimageFromAttribute({ key, value }));
		});
	}

	function handleInvite(event) {
		console.log('handleInvite', event.detail);
		let attributes = hashAttrs(event.detail);

		console.log('[Invite] attributes', attributes);

		// hints are the keys from the KV attributes
		hints = event.detail.map(({ key }) => key);

		const credential = wallet.issue({
			attributes,
			max_entries: 1,
			// We issue this to ourselves, no need to specify a NymProof
			options: null
		});

		// Now that we have created a Credential issued to ourselves, we can create an Offer
		// and send it to the other party
		offer = wallet.offer({
			// The credential we just created
			credential,
			config: {
				// We don't want to redact any fields
				redact: null,
				// No additional entries
				additional_entry: null,
				// Keep the original max_entries
				max_entries: null
			}
		});

		console.log('offer', offer);

		let preimages = event.detail.map(preimageFromAttribute);

		console.log('preimages', preimages);

		let publishingKey = getPublishKey({ vk: offer.issuer_public.vk, preimages });

		let b64pubKey = btoa(String.fromCharCode(...publishingKey));

		console.log('publishingKey', publishingKey, b64pubKey);

		// Replace the hash with contact id, publishingKey, back to the ContactBook
		inviteResolve({ publishingKey, hints });

		// see if you can get phone or email from event.detail ([{key: 'phone', value: '123-456-7890'}])
		// if so, send the offer to that contact
		let phone, email;
		event.detail.forEach(({ key, value }) => {
			if (key == 'phone') phone = value;
			if (key == 'email') email = value;
		});

		console.log('phone', phone, 'email', email);

		// active component is now OfferClipboard
		activeComponent = OfferClipboard;
		activeProps = { offer, hints, phone, email };
	}

	function handleAccept(event) {
		console.log('handleAccept attrs', event.detail);
		const attributes = hashAttrs(event.detail);
		console.log('handleAccept HaSHED attrs', attributes);
		const acceptedCred = wallet.accept(hash.offer);

		// To validate that we entered the answers correctly, we need to do a test proof and verification

		let nonce = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		let provables = {
			credential: acceptedCred,
			entries: [attributes],
			selected: attributes,
			nonce
		};

		// Now we can create a proof
		try {
			let { proof, selected } = wallet.prove(provables);

			// Now we can verify the proof against the issuer's public data and the selected attributes
			let verifiables = {
				proof,
				// todo: this should come from the issuer independently
				issuer_public: acceptedCred.issuer_public,
				selected,
				nonce
			};

			verified = wallet.verify(verifiables);

			// Now we can safely store the accepted credential and the attributes in whatever system is connected to the wallet.
			// The accepted credential will be needed when we want to extend it with more entries of values

			if (verified) {
				console.log('Verified');
			} else {
				console.warn('Not Verified');
			}
		} catch (e) {
			console.error(e);
		}
	}
</script>

<svelte:window on:hashchange={handleHashChange} />

{#if unlock}
	{#if !wallet}
		<Seed on:seed={unlock} {error} {b64Seed} />
	{:else}
		<Header seed={b64Seed} />
		{#if generateAttribute}
			<svelte:component this={activeComponent} {...activeProps} on:event={handleActiveEvt} />
			<!-- {#if hash?.tag == 'invite'} -->
			<!-- 	<!-- turns hash obj into [{key, value}] attributes array -->
			<!-- 	<!-- We need to pass in id so we can associate the PushingKey with the id back in ContactBook -->
			<!-- 	<!-- Filter out any values that are empty or are key = "id" -->
			<!-- 	<Invite -->
			<!-- 		attributes={Object.entries(hash.val) -->
			<!-- 			.filter(([key, value]) => value && key != 'id') -->
			<!-- 			.map(([key, value]) => ({ key, value }))} -->
			<!-- 		{wallet} -->
			<!-- 		{generateAttribute} -->
			<!-- 		on:invite={handleInvite} -->
			<!-- 	/> -->
			<!-- {:else if hash && !verified} -->
			<!-- 	<AcceptOffer {hash} on:accept={handleAccept} /> -->
			<!-- {:else if offer && hints} -->
			<!-- 	<OfferClipboard {offer} {hints} /> -->
			<!-- {:else} -->
			<!-- 	<Invite {wallet} {generateAttribute} on:invite={handleInvite} /> -->
			<!-- {/if} -->
		{/if}
	{/if}
{:else}
	<div class="flex items-center justify-center h-screen">
		<p>Loading...</p>
	</div>
{/if}
