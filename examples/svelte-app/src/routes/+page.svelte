<script>
	import { onMount, tick } from 'svelte';
	import { examples } from '$lib';
</script>

{#if examples}
	<nav class="accordion arrows">
		<header class="box">
			<label for="acc-close" class="box-title">Example Components</label>
		</header>
		{#each examples as example, i}
			<input type="radio" name="accordion" id="cb{i}" />
			<section class="box">
				<label class="box-title" for="cb{i}">{example.name}</label>
				<label class="box-close" for="acc-close"></label>
				<div class="box-content">
					<svelte:component this={example.component} />
				</div>
			</section>
		{/each}
		<input type="radio" name="accordion" id="acc-close" />
	</nav>
{/if}

<style>
	.accordion {
		margin: auto;
		width: 800px;
	}
	.accordion input {
		display: none;
	}
	.box {
		position: relative;
		background: white;
		height: 64px;
		transition: all 0.15s ease-in-out;
	}
	.box::before {
		content: '';
		position: absolute;
		display: block;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		pointer-events: none;
		box-shadow:
			0 -1px 0 #e5e5e5,
			0 0 2px rgba(0, 0, 0, 0.12),
			0 2px 4px rgba(0, 0, 0, 0.24);
	}
	header.box {
		background: #2ec73d;
		z-index: 100;
		cursor: initial;
		box-shadow:
			0 -1px 0 #e5e5e5,
			0 0 2px -2px rgba(0, 0, 0, 0.12),
			0 2px 4px -4px rgba(0, 0, 0, 0.24);
	}
	header .box-title {
		margin: 0;
		font-weight: normal;
		font-size: 16pt;
		color: white;
		cursor: initial;
	}
	.box-title {
		width: calc(100% - 40px);
		height: 64px;
		line-height: 64px;
		padding: 0 20px;
		display: inline-block;
		cursor: pointer;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		-khtml-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
	.box-content {
		width: calc(100% - 40px);
		padding: 30px 20px;
		font-size: 11pt;
		color: rgba(0, 0, 0, 0.54);
		display: none;
	}
	.box-close {
		position: absolute;
		height: 64px;
		width: 100%;
		top: 0;
		left: 0;
		cursor: pointer;
		display: none;
	}
	input:checked + .box {
		height: auto;
		margin: 16px 0;
		box-shadow:
			0 0 6px rgba(0, 0, 0, 0.16),
			0 6px 12px rgba(0, 0, 0, 0.32);
	}
	input:checked + .box .box-title {
		border-bottom: 1px solid rgba(0, 0, 0, 0.18);
	}
	input:checked + .box .box-content,
	input:checked + .box .box-close {
		display: inline-block;
	}
	.arrows section .box-title {
		padding-left: 44px;
		width: calc(100% - 64px);
	}
	.arrows section .box-title:before {
		position: absolute;
		display: block;
		content: '\203a';
		font-size: 18pt;
		left: 20px;
		top: -2px;
		transition: transform 0.15s ease-in-out;
		color: rgba(0, 0, 0, 0.54);
	}
	input:checked + section.box .box-title:before {
		transform: rotate(90deg);
	}
</style>
