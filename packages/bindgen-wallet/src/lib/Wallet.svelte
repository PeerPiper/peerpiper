<script>
	import { onMount } from 'svelte';
	import wasm from '../../../../crates/peerpiper-wasm-bindgen/Cargo.toml';
	import { Seed } from './index.js';

	let unlock, wallet, attribute;
	let error;

	async function loadWasm() {
		if (!import.meta.env.SSR) {
			// This code will only run in the browser
			const exports = await wasm();

			// Use functions which were exported from Rust...
			return { ...exports };
		}
	}

	onMount(async () => {
		const { WasmWallet, attribute } = await loadWasm();

		unlock = async (e) => {
			console.log('Unlocking wallet');
			try {
				wallet = new WasmWallet(e.detail);
				console.log(wallet);
			} catch (e) {
				console.error(error);
				error = e;
			}
		};

		// Now we can create an attribute from Uint8Array
		let myAttribute = attribute(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

		console.log({ myAttribute });
	});
</script>

{#if unlock}
	{#if !wallet}
		<Seed on:seed={unlock} {error} />
	{:else}
		Unlocked
	{/if}
{:else}
	<p>Loading...</p>
{/if}
