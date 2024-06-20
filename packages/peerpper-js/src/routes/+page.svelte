<script>
	import { assets, base, resolveRoute } from '$app/paths';
</script>

<main class="flex flex-col px-8 py-2 w-screen">
	<h1 class="text-2xl font-semibold mt-4">PeerPiper ToolKit</h1>
	<div class="mt-4 border border-neutral-50 rounded bg-sky-50 p-2">
		<a
			href="{base}/integrity-wallet"
			class="border-2 border-neutral-400 rounded-lg shadow-md outline-lime-50 px-4 py-2 w-fit"
			>Integrity Wallet</a
		>
		<p class="p-2">Integrity Wallet is a secure, open-source, non-custodial wallet.</p>
	</div>

	<div class="mt-4 border border-neutral-50 rounded bg-sky-50 p-2">
		<a
			href="{base}/remote"
			class="border-2 border-neutral-400 rounded-lg shadow-md outline-lime-50 px-4 py-2 w-fit"
			>Remote Control</a
		>
		<p class="p-2">Remote Control enables you to access your PeerPiper Node from any browser.</p>
	</div>
</main>

<style>
	h2 {
		@apply text-xl font-semibold mt-8 mb-2;
	}

	p {
		@apply leading-normal my-2;
	}

	.highlighter {
		@apply border-b-2 border-lime-500;
	}

	a {
		@apply border border-neutral-400/50 rounded-lg shadow-md outline-lime-50 px-2 py-1 w-fit bg-sky-200/50 my-4;
	}

	a:not(#el_link)::after {
		content: '➚';
		margin-left: 0.5rem;
	}
</style>
