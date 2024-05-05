<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listen } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/tauri';
	import { Command } from '@tauri-apps/api/shell';
	import Chat from '$lib/Chat.svelte';
	import Spinner from '$lib/Spinner.svelte';
	import NodeControl from '$lib/NodeControl.svelte';

	let ignore = false;
	let ollamaLoaded = false;
	let llama3Downloaded = false;
	let ollamaPort;
	let unListenOllamaLoaded: null | (() => void) = null;
	// let unListenFastembedLoaded: null | (() => void) = null; // todo

	onMount(async () => {
		invoke('tauri_init_command', {});
		unListenOllamaLoaded = await listen('loaded_ollama', async (event) => {
			ollamaLoaded = true;

			ollamaPort = event.payload as number;
			console.log('pulling llama3', `http://127.0.0.1:${ollamaPort}`);
			const command = Command.sidecar('ollama', ['pull', 'llama3'], {
				env: {
					OLLAMA_HOST: `http://127.0.0.1:${ollamaPort}`
				}
			});

			console.log('sending command', command);
			const out = await command.execute();
			if (out.code === 0) {
				console.error(out.stderr);
			} else {
				console.log(out.stdout);
			}
			console.log('pulled llama3');
			llama3Downloaded = true;
		});

		// unListenFastembedLoaded = await listen('loaded_fastembed', (event) => {
		//   fastembedLoaded = true;
		// });

		if (ignore) {
			unListenOllamaLoaded?.();
			unListenOllamaLoaded = null;
			// unListenFastembedLoaded?.();
			// unListenFastembedLoaded = null;
		}
	});

	onDestroy(() => {
		ignore = true;
		unListenOllamaLoaded?.();
		unListenOllamaLoaded = null;
		// unListenFastembedLoaded?.();
		// unListenFastembedLoaded = null;
	});
</script>

{#if !ollamaLoaded && !llama3Downloaded}
	<div class="flex flex-col w-full h-screen mt-6 items-center opacity-50">
		{#if !ollamaLoaded && !llama3Downloaded}
			<div class="text-sm text-gray-300 mb-1">Loading Ollama...</div>
		{:else if ollamaLoaded && !llama3Downloaded}
			<div class="text-sm text-gray-300 mb-1">Downloading Llama3...</div>
		{/if}
		<Spinner />
	</div>
{:else}
	<!-- <Chat /> -->
	<NodeControl />
{/if}
