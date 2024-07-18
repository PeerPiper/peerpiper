<script>
	import { createEventDispatcher } from 'svelte';
	import FileReader from './FileReader.svelte';

	export let wallet;
	export let generateAttribute;

	const dispatch = createEventDispatcher();

	// attribtes is an array of { key, value}
	export let attributes = [
		{ key: 'First Name', value: 'Richard' },
		{ key: 'Last Name', value: 'Hendricks' }
	];

	function addPhoto(event) {
		// find which value is Uint8array (if any) and replace it with the photo
		let index = attributes.findIndex((attr) => attr.value instanceof Uint8Array);
		// turn bytes from ArrayBuffer to Uint8Array
		attributes = [
			...attributes,
			{ key: event.detail.name, value: new Uint8Array(event.detail.bytes) }
		];
	}

  // Create Invite should hide the "create" views and display OfferClipboard to send the offer, then close that view.
	function handleInvite() {
		dispatch('event', attributes);
	}
</script>

<section class="flex flex-col p-2 flex-grow h-full">
	<h1 class="text-2xl font-bold">Invite Builder</h1>
	<p class="text-gray-500">Invite a contact to join your network</p>
	<!-- Create an Invite: Key Value pairs and an optional photo -->
	<!-- Key and Value are in the smae row together, spaced by 1 px. Combined width of side by side 2 input fields shall not exceed the width of the parent -->
	<!-- Bind each possibly chnaging values of each attribute back to the array -->
	<div class="flex-grow flex flex-col space-y-2">
		{#each attributes as attribute}
			<!-- If value is Uint8arry, skip it-->
			<div class="flex flex-row space-x-2 justify-between">
				<input
					type="text"
					class="w-1/2 border border-gray-300 rounded-md p-2"
					placeholder="Label"
					bind:value={attribute.key}
				/>
				{#if attribute.value instanceof Uint8Array}
					<!--Show thumbnail-->
					<img src={URL.createObjectURL(new Blob([attribute.value]))} class="w-auto h-12" />
				{:else}
					<input
				type="text"
						class="w-1/2 border border-gray-300 rounded-md p-2"
						placeholder="Value"
						bind:value={attribute.value}
					/>
				{/if}
				<!-- Red X for deleting this entry-->
				<button
					class="justify-end bg-red-500 rounded-md py-1 px-3 shadow font-semibold text-2xl text-white"
					on:click={() => (attributes = attributes.filter((attr) => attr !== attribute))}
				>
					x
				</button>
			</div>
		{/each}

		<!--Last row provides option to add another entry to attrs-->
		<div class="flex flex-row justify-between gap-4">
			<!-- Browse file for photo (selfie together) -->
			<FileReader on:photo={addPhoto} />
			<button
				class="flex flex-1 w-full h-full justify-center items-center cursor-pointer bg-blue-500 border-2 border-blue-500 rounded-md px-4 py-2 shadow text-white font-semibold"
				on:click={() => (attributes = [...attributes, { key: '', value: '' }])}
			>
				+ Entry
			</button>
		</div>
	</div>
	<div class="flex flex-row space-x-8">
		<!--Cancel button -->
		<button
			class="flex-1 bg-red-500 text-white rounded-md py-3 px-4 mt-4 font-semibold w-full"
			on:click={() => dispatch('cancel')}>CANCEL</button
		>
		<button
			class="flex-1 bg-blue-500 text-white rounded-md py-3 px-4 mt-4 font-semibold w-full"
			on:click={handleInvite}
		>
			Create Invite
		</button>
	</div>
</section>
