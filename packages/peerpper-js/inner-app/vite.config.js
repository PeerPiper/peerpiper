import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createHash } from 'crypto';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { devConfig } from '../config.js';

const devBase = devConfig.devBase;
let base;
const env = loadEnv('', process.cwd(), '');

export default defineConfig(({ command, mode }) => {
	if (command == 'serve') {
		base = devBase;
	} else {
		base = env.VITE_BASE || devBase;
	}

	return {
		plugins: [readOutputFiles(), svelte()],
		build: {
			minify: false
		},
		server: {
			origin: base,
			fs: {
				strict: false
			}
		}
	};
});

// Poached from import sri from '@small-tech/vite-plugin-sri'; // which doesn't work with my code
function readOutputFiles() {
	return {
		name: 'read-output-files', // this name will show up in warnings and errors
		writeBundle(options) {
			// for the given dist/index.html, add integrity attributes to the script and link tags
			const outputDir = options.dir || path.dirname(options.file) || 'dist';
			const outputFilePath = path.join(outputDir, 'index.html');
			const outputHtml = fs.readFileSync(outputFilePath, 'utf8');
			const $ = cheerio.load(outputHtml);
			const scripts = $('script').filter('[src]');
			const stylesheets = $('link[rel=stylesheet]').filter('[href]');

			scripts.each((index, element) => {
				const scriptElement = $(element);
				const scriptSrc = scriptElement.attr('src');
				const scriptPath = path.join(outputDir, scriptSrc);
				let scriptContent = fs.readFileSync(scriptPath, 'utf8');

				// find matches for /assets/ in the scriptContent
				let matches = scriptContent.match(/"\/assets\//g);

				// insert ${base} before `assets/` in the source code scriptContent
				// so that the innerApp can load the correct urls
				scriptContent = scriptContent.replace(/"\/assets\//g, `"${base}/assets/`);
				// write the modified scriptContent back to the file
				fs.writeFileSync(scriptPath, scriptContent);

				const algo = 'sha384';
				const integrity = createHash(algo).update(scriptContent).digest().toString('base64');
				scriptElement.attr('integrity', `${algo}-${integrity}`);
			});

			stylesheets.each((index, element) => {
				const linkElement = $(element);
				const linkHref = linkElement.attr('href');
				const linkPath = path.join(outputDir, linkHref);
				let linkContent = fs.readFileSync(linkPath, 'utf8');

				// insert ${base} before `assets/` in the source code linkContent
				// so that the innerApp can load the correct urls
				linkContent = linkContent.replace(/"\/assets\//g, `"${base}/assets/`);
				// write the modified linkContent back to the file
				fs.writeFileSync(linkPath, linkContent);

				const algo = 'sha384';
				const integrity = createHash(algo).update(linkContent).digest().toString('base64');
				linkElement.attr('integrity', `${algo}-${integrity}`);
			});

			fs.writeFileSync(outputFilePath, $.html());
		}
	};
}
