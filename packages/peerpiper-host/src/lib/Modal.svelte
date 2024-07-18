<!-- Component that goes from hidden to shown and back -->
<script>
	import { fade } from 'svelte/transition';
	export let isVisible = true;

	function toggleVisibility() {
		console.log('toggling visibility');
		isVisible = !isVisible;
	}
</script>

<!-- Modal is on top of everything else -->
<div
	hidden={!isVisible}
	transition:fade={{ duration: 300 }}
	class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-20"
>
	<!-- This content will fade in and out, but remain in the DOM -->
	<button class="absolute top-0 right-0 p-4 cusor-pointer z-20" on:click={toggleVisibility}
		>X</button
	>
	<slot />
</div>

<style>
	div[hidden] {
		display: none;
	}
	div:not([hidden]) {
		display: block;
	}
</style>
