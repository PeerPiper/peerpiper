<script>
	export let title = 'Click to expand/collapse';
	export let isOpen = false;

	function expandDetails() {
		isOpen = true;
	}

	function collapseDetails() {
		isOpen = false;
	}

	function toggleDetails() {
		isOpen = !isOpen;
	}
</script>

<details bind:open={isOpen}>
	<summary class="cursor-pointer select-none">{title}</summary>
	<slot />
</details>
