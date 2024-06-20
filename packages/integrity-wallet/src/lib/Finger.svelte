<script>
	import { onMount } from 'svelte';
	import finger from './images/pointer-finger.svg';
</script>

<div class="relative top-12 left-12 p-1 w-12 h-12">
	<img
		class="self-center w-fit object-cover max-w-48 max-h-48"
		src={finger}
		alt="Drag link to tab bar or click to copy link"
	/>
</div>

<!-- CSS animation should sweep the pointer up to middle of the top of the screen (top-0), disappear, then start back to origin and sweep up again infinitely -->

<style>
	@keyframes sweep {
		0% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-450%);
		}
		100% {
			transform: translateY(0);
		}
	}

	img {
		animation: sweep 3s infinite;
	}
</style>
