import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import rust from '@wasm-tool/rollup-plugin-rust';

export default defineConfig({
	plugins: [rust(), sveltekit()]
});
