<script>
	// A basic call to the peerpiper wasm-bindgen API to ping and show pings.
	import peerpiper from '../../../../../crates/peerpiper-browser/Cargo.toml';

	// import peerpiper_browser_js from '../../../../../crates/peerpiper-browser/pkg/peerpiper_browser.js?raw';
	// import wasmURL from '../../../../../crates/peerpiper-browser/pkg/peerpiper_browser_bg.wasm?url';
	//
	// let exportsString = 'Loading...';

	async function loadWasm() {
		if (!import.meta.env.SSR) {
			// This code will only run in the browser
			const mod = await peerpiper();

			// Use functions which were exported from Rust...
			console.log({ mod });

			// Start peerpiper-server to get a local Multiaddr at port 8080:
			const res = await fetch('http://localhost:8080/');
			const addr = await res.text();

			let onping = (ping) => {
				console.log('Event emitted: ', { ping });
			};

			mod.connect(addr, onping);

			// Show the code:

			// let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());
			// let wasmBlobUrl = URL.createObjectURL(new Blob([wasmBytes], { type: 'application/wasm' }));
			// exportsString = peerpiper_browser_js.replace(
			// 	`new URL('peerpiper_browser_bg.wasm', import.meta.url)`,
			// 	`'${wasmBlobUrl}'`
			// );
		}
	}

	loadWasm();
</script>

<code>
	<pre>
    <!-- {exportsString} -->
  </pre>
</code>
