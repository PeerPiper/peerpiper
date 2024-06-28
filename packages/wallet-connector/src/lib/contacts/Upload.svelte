<script>
	import { onMount, createEventDispatcher } from 'svelte';

	let fileinput;
	let accept = ['.png', '.jpg', '.jpeg', '.gif', '.wasm'];

	const dispatch = createEventDispatcher();
	const files = new Map();

	let fileDeets;
	let name;

	const onFileSelected = (e) => {
		let plugin = e.target.files[0];
		let reader = new FileReader();

		files.set(reader, plugin);

		reader.addEventListener('loadend', (evt) => {
			// reader.result contains the contents of blob as a typed array
			fileDeets = { bytes: reader.result, name };
			dispatch('upload', fileDeets);
		});

		reader.addEventListener('load', (evt) => {
			const file = files.get(evt.target);
			name = file.name;
		});

		// reader.readAsDataURL(plugin);
		reader.readAsArrayBuffer(plugin);
		// reader.readAsText(plugin);
	};
</script>

<input
	style="display:none"
	type="file"
	accept={accept.join(',')}
	on:change={(e) => onFileSelected(e)}
	bind:this={fileinput}
/>
<div class="flex flex-col py-4">
	<div
		class="flex w-fit cursor-pointer"
		on:keypress={() => {
			fileinput.click();
		}}
		on:click={() => {
			fileinput.click();
		}}
	>
		<div class="flex p-2 rounded-md shadow border">Browse {accept.join(', ')} file...</div>
	</div>
	<!-- Show list of file names -->
	{#if fileDeets}
		<div class="flex flex-col space-y-2 py-2">
			<div class="flex flex-row space-x-2">
				<div class="flex-0">Name:</div>
				<div class="flex-1">{name}</div>
			</div>
			<div class="flex flex-row space-x-2">
				<div class="flex-0">Size:</div>
				<div class="flex-1">{fileDeets.bytes.byteLength} bytes</div>
			</div>
		</div>
	{/if}
</div>

<style lang="postcss">
	@tailwind utilities;
</style>
