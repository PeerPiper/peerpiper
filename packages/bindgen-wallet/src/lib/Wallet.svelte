<script>
	import { onMount, setContext, createEventDispatcher } from 'svelte';
	import { Seed, Invite, Header } from './index.js';
	import OfferClipboard from './components/OfferClipboard.svelte';
	import AcceptOffer from './components/AcceptOffer.svelte';

	import wasm from '../../../../crates/peerpiper-wasm-bindgen/Cargo.toml';

	let unlock, wallet, generateAttribute, getPublishKey;
	let error;
	let b64Seed;
	let hash;
	let offer, hints;
	let verified;

	const KEY_BASE64_SEED = 'encrypted_seed_base64';

	async function loadWasm() {
		if (!import.meta.env.SSR) {
			// This code will only run in the browser
			const exports = await wasm();

			// Use functions which were exported from Rust...
			return { ...exports };
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
		console.log('hash', hash);

		unlock = async (e) => {
			try {
				wallet = new WasmWallet(e.detail);
				let encrSeed = wallet.encryptedSeed();
				// to Uint8Array, to base64 string
				let seed = new Uint8Array(encrSeed);
				b64Seed = btoa(String.fromCharCode(...seed));
				localStorage.setItem(KEY_BASE64_SEED, b64Seed);
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
		// create string of `key = value`, except for Uint8Array (just the value is enough)
		if (value instanceof Uint8Array) {
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
		let attributes = hashAttrs(event.detail);

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

		let publishKey = getPublishKey({ vk: offer.issuer_public.vk, preimages });

		let b64pubKey = btoa(String.fromCharCode(...publishKey));

		console.log('publishKey', publishKey, b64pubKey);
	}

	function handleAccept(event) {
		const attributes = hashAttrs(event.detail);
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

{#if unlock}
	{#if !wallet}
		<Seed on:seed={unlock} {error} {b64Seed} />
	{:else}
		<Header seed={b64Seed} />
		{#if generateAttribute}
			{#if hash && !verified}
				<AcceptOffer {hash} on:accept={handleAccept} />
			{:else if offer && hints}
				<OfferClipboard {offer} {hints} />
			{:else}
				<Invite {wallet} {generateAttribute} on:invite={handleInvite} />
			{/if}

			<!-- If offer, create an email link to send them the text file, and the hints as body text. -->
		{/if}
	{/if}
{:else}
	<div class="flex items-center justify-center h-screen">
		<p>Loading...</p>
	</div>
{/if}
