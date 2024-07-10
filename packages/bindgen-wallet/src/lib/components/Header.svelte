<script>
	// a little header component that displays seed in the upper right hand corner
	export let seed;
</script>

<section class="absolute top-0 right-0 p-4 bg-gray-300 text-gray-800 bg-opacity-50">
	{#if seed}
		<!-- Show the first 7 chars then ... -->
		<div class="text-sm">{seed.slice(0, 7)}...</div>
	{/if}
</section>
