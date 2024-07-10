<script>
	// a component to send data to a plugin
	import { onMount, tick, createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();
	const files = new Map();
	let fileinput;
	let photo;
	let name;

	const onFileSelected = (e) => {
		let plugin = e.target.files[0];
		let reader = new FileReader();

		files.set(reader, plugin);

		reader.addEventListener('loadend', (evt) => {
			// reader.result contains the contents of blob as a typed array
			photo = { bytes: reader.result, name };
			dispatch('photo', photo);
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
	accept=".jpg,.jpeg,.png,.gif,.bmp,.webp"
	on:change={(e) => onFileSelected(e)}
	bind:this={fileinput}
/>
<div
	class="flex flex-1 w-full h-full justify-center items-center cursor-pointer bg-green-500 border-2 border-green-500 rounded-md px-4 py-2 shadow text-white font-semibold"
	on:keypress={() => {
		fileinput.click();
	}}
	on:click={() => {
		fileinput.click();
	}}
>
	Add photo...
</div>
