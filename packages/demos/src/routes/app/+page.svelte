<script>
	import { onMount, tick, createEventDispatcher } from 'svelte';
	import { WurboComponent, wurboIn } from 'wurbo';

	// Import wasm component bytes as a url
	import wasmURL from '../../../../../target/wasm32-wasi/release/contact_book.wasm?url';

	const dispatch = createEventDispatcher();

	/**
	 * Pass in all initial content to the component
	 * This is the initial data that the component will use to render
	 * and interact with the user
	 * @type {Object} data - The initial data to pass to the component
	 */
	export let data = {
		tag: 'all-content',
		val: {}
	};

	const eventHandler = (payload) => {
		console.log('Contact Book Wasm Component emitted an event:', payload);
		dispatch('event', payload);
	};
</script>

<svelte:head>
	<script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

<WurboComponent {wasmURL} {data} {eventHandler} />
