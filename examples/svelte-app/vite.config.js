import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import rust from '@wasm-tool/rollup-plugin-rust';

export default defineConfig({
	plugins: [rust(), sveltekit()],
	server: {
		fs: {
			strict: false,
			allow: [
				// search up for workspace root
				searchForWorkspaceRoot(process.cwd())
			]
		}
	},
	build: {
		minify: false
	},
	worker: {
		format: 'es'
	}
});
