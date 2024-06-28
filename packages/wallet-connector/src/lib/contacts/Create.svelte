<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import Upload from './Upload.svelte';

	const dispatch = createEventDispatcher();

	let attributes = [
		{ key: 'First Name', value: '' },
		{ key: 'Last Name', value: '' },
		{ key: 'Email', value: '' }
	];

	function handleFiles(event) {
		const { name, bytes } = event.detail;
		// push onto attrs object
		console.log(name, bytes);
		attributes = [...attributes, { key: name, value: bytes }];
	}

	function handleSign() {
		console.log('signing invite', attributes);
		dispatch('sign', attributes);
	}
</script>

<div class="">
	{#each attributes as { key, value }}
		<div class="flex flex-col">
			<!-- make the {attribute} key editable, and bind it's value to the {attribute} key in the attributes object -->
			<input
				type="text"
				class="border-0 border-gray-300 rounded-md py-1 font-semibold"
				id="name"
				bind:value={key}
			/>
			<input type="text" class="border border-gray-300 rounded-md p-2" id="name" bind:value />
		</div>
	{/each}
	<!-- <div class="flex flex-row align-middle items-center space-x-2"> -->
	<!-- 	<h2 class="flex-0 text-lg font-semibold">Security Phrase</h2> -->
	<!-- 	<select class="border border-gray-300 rounded-md p-2 flex-grow"> -->
	<!-- 		<option>Place where we met</option> -->
	<!-- 		<option>How we know each other</option> -->
	<!-- 	</select> -->
	<!-- </div> -->

	<Upload on:upload={handleFiles} />
	<div class="bg-blue-500 text-white rounded-md p-2 w-fit cursor-pointer" on:click={handleSign}>
		Sign Invite
	</div>

	<!--Show draft Invite, key & values except just name for the file-->
	{#if attributes}
		<div class="flex flex-col space-y-2 py-2">
			{#each attributes as { key, value }}
				<div class="flex flex-row space-x-2">
					{#if value instanceof ArrayBuffer}
						<div class="flex flex-row space-x-2">
							<div class="flex-0">File Name:</div>
							<div class="flex-1">{key} {value.byteLength} bytes</div>
						</div>
					{:else}
						<div class="flex flex-row space-x-2">
							<div class="flex-0">{key}:</div>
							<div class="flex-1">{value}</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
