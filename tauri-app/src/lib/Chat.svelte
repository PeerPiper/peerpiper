<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { listen } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/tauri';
	import SvelteMarkdown from 'svelte-markdown';

	let scrollRef: HTMLElement | null = null;
	let working = false;
	let question = '';
	let context = '';
	let answer = [];
	$: answerText = answer.join('') + (working ? '...' : '');

	let unListenChatToken: null | (() => void) = null;
	let unListenChatFinished: null | (() => void) = null;
	let ignore = false;

	function scrollDown() {
		if (scrollRef) {
			scrollRef.scrollTop = scrollRef.scrollHeight;
		}
	}

	onMount(async () => {
		unListenChatToken = await listen('chatToken', (event) => {
			if (ignore) return;
			console.log('chatToken received', event);
			answer = [...answer, event.payload as string];
			scrollDown();
		});
		unListenChatFinished = await listen('chatFinished', (event) => {
			if (ignore) return;
			console.log('chatFinished received', event);
			working = false;
			scrollDown();
		});
		if (ignore) {
			unListenChatToken?.();
			unListenChatToken = null;
			unListenChatFinished?.();
			unListenChatFinished = null;
		}
	});

	onDestroy(() => {
		ignore = true;
		unListenChatToken?.();
		unListenChatToken = null;
		unListenChatFinished?.();
		unListenChatFinished = null;
	});

	async function doChat() {
		working = true;
		answer = [];

		// todo
		// const embedding = await embedIssue(question ?? '');

		invoke('start_chat', { question: question, context: context ?? '' });
	}

	async function stopChat() {
		setWorking(false);
		console.log('stopChat');
		invoke('stop_chat');
	}
</script>

<div class="flex flex-col flex-grow items-center h-screen">
	<div class="flex flex-col w-full">
		<div class="flex flex-shrink-0 pr-6 border-b border-gray-200 h-14 pl-3 md:pl-5 lg:pl-9">
			<div class="flex items-center font-semibold ms-2">Local Llama Chat</div>
			<div class="flex items-center ms-auto">
				<button class="bg-red-500 text-white px-4 py-2 rounded shadow-md font-semibold">X</button>
			</div>
		</div>
	</div>
	<!-- Chat -->
	<div class="flex flex-row flex-grow items-center h-full w-full overflow-y-auto">
		<div
			bind:this={scrollRef}
			class="flex flex-col flex-grow items-center h-full w-full overflow-y-auto"
		>
			<div class="h-full p-5 max-w-prose min-w-prose prose w-full">
				{#if working && answer.length === 0}
					<div class="opacity-50">Loading...</div>
				{:else}<SvelteMarkdown source={answerText} />
				{/if}
			</div>
		</div>
	</div>
	<div
		class="w-full flex items-center justify-between flex-shrink-0 pl-6 pr-6 border-t border-gray-200 py-2"
	>
		<input
			type="search"
			placeholder="Ask me anything"
			class="w-full bg-gray-100 border-0 rounded px-2 py-1.5"
			bind:value={question}
			on:keydown={(e) => e.key === 'Enter' && doChat()}
		/>
		<button
			class="bg-blue-500 text-white px-4 py-2 rounded shadow-md font-semibold"
			style:height="2.5rem"
			style:w="6rem"
			on:click={doChat}
			disabled={working}
		>
			{working ? 'working...' : 'Ask'}
		</button>
		<button
			class="flex-shrink-0 bg-gray-100 border-0 rounded px-2 py-1.5 ms-2"
			class:opacity-50={!working}
			style:height="2.5rem"
			on:click={stopChat}
			disabled={!working}
		>
			Stop
		</button>
	</div>
</div>

<style>
	code {
		@apply max-w-prose break-all;
	}
</style>
