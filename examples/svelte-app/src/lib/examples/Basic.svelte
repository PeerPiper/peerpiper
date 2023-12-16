<script>
	// A basic call to the peerpiper wasm-bindgen API to ping and show pings.
	import peerpiper from '../../../../../crates/peerpiper-browser/Cargo.toml';

	let exportsString = 'Loading...';

	async function loadWasm() {
		if (!import.meta.env.SSR) {
			// This code will only run in the browser
			const mod = await peerpiper();

			// Use functions which were exported from Rust...
			console.log({ mod });

			// convert exports to string:
			exportsString = mod.connect.toString();

			// Start peerpiper-server to get a local Multiaddr at port 8080:
			const res = await fetch('http://localhost:8080/');
			const addr = await res.text();

			let onping = (ping) => {
				console.log('Event emitted: ', { ping });
			};

			mod.connect(addr, onping);
		}
	}

	loadWasm();
</script>

Ping PeerPiper
<br />
{exportsString}
