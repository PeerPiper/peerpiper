<script>
	// A basic call to the peerpiper wasm-bindgen API to ping and show pings.
	import peerpiper from '../../../../../crates/peerpiper-browser/Cargo.toml';

	import peerpiper_browser_js from '../../../../../crates/peerpiper-browser/pkg/peerpiper_browser.js?raw';
	import wasmURL from '../../../../../crates/peerpiper-browser/pkg/peerpiper_browser_bg.wasm?url';

	let exportsString = 'Loading...';

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

			// let importables = [{ 'component:cargo-comp/peerpiper-browser': peerpiper_browser_js },
			// { 'peerpiper_browser_bg.wasm': peerpiper_browser_bg_wasm}];
			// Load the wasm component bytes as an array buffer
			let wasmBytes = await fetch(wasmURL).then((res) => res.arrayBuffer());

			// make a blob url of the bytes of the wasm file
			let wasmBlobUrl = URL.createObjectURL(new Blob([wasmBytes], { type: 'application/wasm' }));
			// find and replace
			// code = code.replace(`new URL('./${fileName}', import.meta.url)`, `'${wasmBlobUrl}'`);
			exportsString = peerpiper_browser_js.replace(
				`new URL('peerpiper_browser_bg.wasm', import.meta.url)`,
				`'${wasmBlobUrl}'`
			);
		}
	}

	loadWasm();
</script>

Ping PeerPiper
<br />
{exportsString}
