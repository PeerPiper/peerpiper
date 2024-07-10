import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { loadEnv } from 'vite';
import fs from 'fs';
import { devConfig } from './config.js';
import rust from '@wasm-tool/rollup-plugin-rust';

const packageJson = JSON.parse(fs.readFileSync('inner-app/package.json', 'utf8'));
const version = packageJson.version;

const strictPort = true;

let index = fs.readFileSync('./inner-app/dist/index.html', 'utf-8');
const template = fs.readFileSync('./template.js', 'utf-8');
// replace backticks and ${} with escaped versions
index = index.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const innerApp = template.replace('%%index%%', index);

const name = 'innerApp.js';
const dirName = 'inner-app';

// delete static/innerApp.js if it exists
if (fs.existsSync(`static/${version}/${name}`)) {
	fs.unlinkSync(`static/${version}/${name}`);
}

if (!fs.existsSync(`static/${version}/assets`)) {
	fs.mkdirSync(`static/${version}`);
	fs.mkdirSync(`static/${version}/assets`);
}

fs.writeFileSync(`static/${version}/${name}`, innerApp);
// also copy over files, create the dir and files if they don't exist
const assets = fs.readdirSync(`./${dirName}/dist/assets`);

// delete the destination assets if they exist
fs.readdirSync(`static/${version}/assets`).forEach((file) => {
	fs.unlinkSync(`static/${version}/assets/${file}`);
});

assets.forEach((asset) => {
	fs.copyFileSync(`./${dirName}/dist/assets/${asset}`, `static/${version}/assets/${asset}`);
});

export default defineConfig(({ command, mode }) => {
	let base;
	const env = loadEnv(mode, process.cwd(), '');

	if (command == 'serve') {
		base = devConfig.devBase;
	} else {
		base = env.VITE_BASE || devConfig.devBase;
	}

	const innerAppPath = `static/${version}/${name}`;
	let innerAppFile = fs.readFileSync(innerAppPath, 'utf-8');
	innerAppFile = innerAppFile.replace(/"\/assets\//g, `"${base}/${version}/assets/`);
	fs.writeFileSync(innerAppPath, innerAppFile);

	const assetsPath = `static/${version}/assets`;
	fs.readdirSync(assetsPath).forEach((file) => {
		if (file.endsWith('.js')) {
			let content = fs.readFileSync(`${assetsPath}/${file}`, 'utf-8');
			content = content.replace(/"\/assets\//g, `"${base}/${version}/assets/`);
			fs.writeFileSync(`${assetsPath}/${file}`, content);
		}
	});

	return {
		plugins: [sveltekit(), rust({ verbose: true })],
		test: {
			include: ['src/**/*.{test,spec}.{js,ts}']
		},
		server: {
			origin: `http://${devConfig.host}:${devConfig.port}`,
			host: devConfig.host,
			port: devConfig.port,
			strictPort,
			fs: {
				strict: false
			}
		},
		worker: {
			format: 'es'
		},
		preview: { port: devConfig.port }
	};
});
