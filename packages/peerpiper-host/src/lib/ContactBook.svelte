<script>
	import { onMount, tick, createEventDispatcher } from 'svelte';
	import { WurboComponent, wurboIn } from 'wurbo';

	// Import wasm component bytes as a url
	import wasmURL from '../../../../target/wasm32-wasip1/release/contact_book.wasm?url';

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

	// console when data changes
	$: console.log('ContactBook data changed', data);

	const eventHandler = (payload) => {
		console.log('Contact Book Wasm Component emitted an event:', payload);
		dispatch('event', payload);
	};
</script>

<!-- <WurboComponent {wasmURL} {data} {eventHandler} /> -->
{#if WurboComponent && data && eventHandler}
	<WurboComponent {wasmURL} {data} {eventHandler} />
{/if}
