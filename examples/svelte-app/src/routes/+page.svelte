<script>
	import { onMount, tick } from 'svelte';
	import { examples } from '$lib';
</script>

<div>
	<!-- For each Svelte file in examples, display it -->
	{#if examples}
		{#each examples.default as example}
			<div>
				<svelte:component this={example} />
			</div>
		{/each}
	{/if}
</div>
