import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import rust from '@wasm-tool/rollup-plugin-rust';

export default defineConfig({
	plugins: [rust(), sveltekit()],
	server: { fs: { strict: false } },
	build: {
		minify: false
	},
	worker: {
		format: 'es'
	}
});
