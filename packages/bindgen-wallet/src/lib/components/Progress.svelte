<!-- Simple tweened progress bar in Svelte -->
<script>
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	export let duration = 20000;

	let progress = 100;

	const progressTweened = tweened(5, {
		duration,
		easing: cubicOut
	});

	progressTweened.set(progress);
</script>

<progress value={$progressTweened} max="100" />

<style>
	progress {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 10px;
		border-radius: 5px;
		background-color: #eee;
		outline: none;
	}

	progress::-webkit-progress-bar {
		background-color: #eee;
		border-radius: 5px;
	}

	progress::-webkit-progress-value {
		background-color: #0ad325;
		border-radius: 5px;
	}
</style>
