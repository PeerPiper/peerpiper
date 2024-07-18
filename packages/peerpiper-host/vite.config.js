import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import rust from '@wasm-tool/rollup-plugin-rust';

export default defineConfig({
	plugins: [sveltekit(), rust()],
	optimizeDeps: {
		// include: ['wurbo'],
		exclude: ['wurbo']
	},
	worker: {
		format: 'es'
	},
	server: {
		fs: {
			strict: false
		}
	}
});
