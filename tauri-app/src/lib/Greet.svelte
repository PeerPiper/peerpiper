<script>
	import { invoke } from '@tauri-apps/api/tauri';

	let name = '';
	let greetMsg = '';

	async function greet() {
		greetMsg = await invoke('greet', { name });
	}
</script>

<div>
	<form>
		<input id="greet-input" placeholder="Enter a name..." bind:value={name} />
		<button on:click={greet} class="bg-green-500 text-white">Greet</button>
	</form>
	<p>{greetMsg}</p>
</div>

<style>
	button {
		@apply px-4 py-2 rounded shadow-md font-semibold;
	}
</style>
