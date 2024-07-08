<script>
	// Seed entry page
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// if error, change input borders to red.
	export let error;

	$: errorClass = error ? 'border-red-500' : '';

	// on Submit, dispatch 'seed' event
	function handleSubmit(event) {
		event.preventDefault();
		const form = event.target;
		const formData = new FormData(form);
		const data = Object.fromEntries(formData.entries());
		console.log('emiting ', data);
		dispatch('seed', data);
	}
</script>

<!-- Use tailwindcss to format the login screen for mobile first. When screen is larger, form should take up less screen space -->
<div
	class="relative flex min-h-screen flex-col justify-center overflow-hidden bg-gray-50 py-6 sm:py-12"
>
	<div
		class="relative bg-white px-6 pt-10 pb-8 shadow-xl ring-1 ring-gray-900/5 sm:mx-auto sm:max-w-lg sm:rounded-lg sm:px-10"
	>
		<div class="mx-auto max-w-md">
			<h1 class="text-3xl font-bold pb-4">Access</h1>
			<form
				class="flex flex-col space-y-4 mx-auto min-w-md"
				on:submit|preventDefault={handleSubmit}
			>
				<label for="username">Username</label>
				<input
					type="text"
					id="username"
					name="username"
					autocomplete="username"
					class="border py-2 px-4 rounded-lg bg-sky-100 text-black"
					class:border-red-500={!!error}
				/>
				<label for="password">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					autocomplete="current-password"
					class={`border py-2 px-4 rounded-lg bg-sky-100 text-black ${errorClass}`}
				/>
				<!-- Error msg, if any-->
				{#if error}
					<p class="text-red-500 text-sm">Invalid username or password, {error}</p>
				{/if}
				<label for="seed">Encrypted Seed</label>
				<input
					type="text"
					id="seed"
					name="seed"
					class="border py-2 px-4 rounded-lg bg-amber-50 text-black"
				/>
				<div class="text-sm text-gray-500">
					<p>Seed is encrypted with your username and password.</p>

					<p>If you don't have one, a random seed will be generated for you</p>
				</div>
				<button type="submit" class="bg-blue-500 text-white rounded-md p-2">Unlock</button>
			</form>
		</div>
	</div>
</div>
