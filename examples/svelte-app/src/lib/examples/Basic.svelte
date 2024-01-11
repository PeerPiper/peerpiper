<script>
	// A basic call to the peerpiper wasm-bindgen API to ping and show pings.
	import peerpiper from '../../../../../crates/peerpiper-browser/Cargo.toml';

	// below import are for code display only, not needed for production:
	import peerpiper_browser_js from '../../../../../crates/peerpiper-browser/pkg/peerpiper_browser.js?raw';
	import wasmURL from '../../../../../crates/peerpiper-browser/pkg/peerpiper_browser_bg.wasm?url';

	let exportsString = null;
	let res;

	async function loadWasm() {
		if (!import.meta.env.SSR) {
			// This code will only run in the browser
			const mod = await peerpiper();

			// Use functions which were exported from Rust...
			console.log({ mod });

			// Start peerpiper-server to get a local Multiaddr at port 8080:
			// use try / catch to possibly display "Have you started the server?"
			try {
				res = await fetch('http://localhost:8080/');
			} catch (e) {
				console.log('Have you started the server?');
			}

			const addr = await res.text();

			let onping = (ping) => {
				console.log('Event emitted: ', { ping });
			};

			mod.connect(addr, onping);

			// Show the code:

			let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());
			let wasmBlobUrl = URL.createObjectURL(new Blob([wasmBytes], { type: 'application/wasm' }));
			exportsString = peerpiper_browser_js.replace(
				`new URL('peerpiper_browser_bg.wasm', import.meta.url)`,
				`'${wasmBlobUrl}'`
			);
		}
	}

	loadWasm();
</script>

<div>
	{#if exportsString}
		<code>
			<pre>
		    {exportsString}
      </pre>
		</code>
	{:else}
		No server response. Did you start the server?<br />
		Try calling:
		<code>
			<pre>
       $ cargo run -p peerpiper-server
      </pre>
		</code>
	{/if}
</div>

<style>
	/* Line Wrap the pre tag elements  */
	pre {
		white-space: pre-wrap; /* Since CSS 2.1 */
		white-space: -moz-pre-wrap; /* Mozilla, since 1999 */
		white-space: -pre-wrap; /* Opera 4-6 */
		white-space: -o-pre-wrap; /* Opera 7 */
		word-wrap: break-word; /* Internet Explorer 5.5+ */
	}
</style>
