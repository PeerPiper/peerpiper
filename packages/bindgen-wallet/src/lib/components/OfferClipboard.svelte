<script>
	export let offer;
	export let hints;
</script>

<div class="p-2">
	<p class="my-4">
		Send them this link with the offer & hints, plus any photo you used in your invite:
	</p>
	<!-- Copy link button, link is the current origin plus a encoded URI hash afterwards -->
	<button
		class="bg-blue-500 text-white rounded-md py-2 px-4 flex justify-center items-center font-semibold"
		on:click={() => {
			const url = new URL(window.location.href);
			// base64 encode { offer, hints }
			url.hash = btoa(JSON.stringify({ offer, hints }));
			// print out the length / size of the hash
			console.log('hash size:', url.hash.length);
			navigator.clipboard.writeText(url.href);
		}}
	>
		Copy Link <svg
			xmlns="http://www.w3.org/2000/svg"
			width="1em"
			height="1em"
			viewBox="0 0 256 256"
			class="m-3"
			><path
				fill="currentColor"
				d="M216 32H88a8 8 0 0 0-8 8v40H40a8 8 0 0 0-8 8v128a8 8 0 0 0 8 8h128a8 8 0 0 0 8-8v-40h40a8 8 0 0 0 8-8V40a8 8 0 0 0-8-8m-56 176H48V96h112Zm48-48h-32V88a8 8 0 0 0-8-8H96V48h112Z"
			/></svg
		>
	</button>
</div>
