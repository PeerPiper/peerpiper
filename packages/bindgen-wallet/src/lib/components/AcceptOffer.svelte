<script>
	import { createEventDispatcher } from 'svelte';
	import FileReader from './FileReader.svelte';

	export let hash;

	const dispatch = createEventDispatcher();

	let error;
	let { offer, hints } = hash;

	// set inital attributes values to hints, leave values empty
	let attributes = hints.map((hint) => ({ key: hint, value: '' }));
</script>

<section class="p-2">
	<h1 class="text-2xl font-bold">Accept Invite</h1>
	<p class="text-gray-500">
		Accept an offer from a contact to join their network. Fill in the values.
	</p>
	<div class="flex flex-col space-y-2">
		{#each attributes as attribute, i}
			<div class="flex flex-row space-x-2 justify-between">
				<input
					type="text"
					class="w-1/2 border border-gray-300 rounded-md p-2"
					value={attribute.key}
					disabled
				/>
				<!-- If key has .jpg, .gif, or .png, allow image upload instead -->
				{#if attribute.key.match(/\.(jpg|gif|png|jpeg|bmp|webp)$/)}
					<!-- If value is empty, then show FileReader. If it's bytes, then show thumnail -->
					{#if !attribute.value}
						<FileReader
							on:photo={(e) => {
								console.log(e);
								// attributes[i].value = e.detail.bytes;
								attributes = attributes.map((a, j) => {
									if (i === j) {
										return { ...a, value: new Uint8Array(e.detail.bytes) };
									}
									return a;
								});
								console.log('[AcceptOffer]: attributes', attributes);
							}}
						/>
					{:else}
						<img src={URL.createObjectURL(new Blob([attribute.value]))} class="w-auto h-12" />
					{/if}
				{:else}
					<input
						type="text"
						class="w-1/2 border border-sky-300 rounded-md p-2"
						class:border-red-500={error}
						placeholder="Answer"
						bind:value={attribute.value}
					/>
				{/if}
			</div>
		{/each}
		{#if error}
			<p class="text-red-500 text-sm">One of your answers if wrong</p>
		{/if}
		<button
			class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
			on:click={() => {
				dispatch('event', attributes);
			}}
		>
			Accept Invite
		</button>
	</div>
</section>
