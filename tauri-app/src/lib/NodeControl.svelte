<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { invoke } from '@tauri-apps/api/tauri';
	import { once, listen } from '@tauri-apps/api/event';

	import type { UnlistenFn } from '@tauri-apps/api/event';

	let unlisten: null | UnlistenFn = null;
	let serverMultiaddr: string;

	onMount(async () => {
		let unlistenAddr = await once('serverMultiaddr', async (evt) => {
			const { event, id, payload } = evt;
			serverMultiaddr = payload as string;
		});

		let unlistenConnectionClosed = await listen('connectionClosed', async (evt) => {
			const { event, id, payload } = evt;
			serverMultiaddr = null;
		});

		// invoke ready, tell Tauri we're ready to listen
		invoke('client_ready');

		return () => {
			// destroy the listeners on dismount
			unlistenAddr();
			unlistenConnectionClosed();
		};
	});
</script>

<div
	class="absolute top-0 right-0 m-2 flex items-center rounded bg-slate-500/50 p-2 font-semibold text-slate-100 drop-shadow"
>
	{#if !serverMultiaddr}
		<div class="mr-1 h-3 w-3 animate-bounce rounded-full bg-amber-300" />
		<div class="flex-initial">Connecting...</div>
	{:else}
		<div class="m-1 h-2 w-2 animate-ping rounded-full bg-emerald-400" />
		<div class="flex-initial">Live</div>
	{/if}
</div>

<div class="flex flex-col items-center justify-start h-full w-full p-4">
	<h1 class="text-3xl font-bold mb-4">PeerPiper Node Controls</h1>
	<div class="flex text-lg text-left w-full break-all">
		{#if serverMultiaddr}
			<div class="flex flex-col">
				<div class="font-semibold mb-4">Connect to this Node using this address:</div>
				<div class="text-sm">{serverMultiaddr}</div>
			</div>
		{:else}
			listening for server to send multiaddr...
		{/if}
	</div>
</div>
