<script>
	// A basic call to the peerpiper wasm-bindgen API to ping and show pings.
	import peerpiper from '../../../../../crates/peerpiper-browser/Cargo.toml';

	async function loadWasm() {
		if (!import.meta.env.SSR) {
			// This code will only run in the browser
			const exports = await peerpiper();

			// Use functions which were exported from Rust...
			console.log({ exports });

			// Start peerpiper-server to get a local Multiaddr at port 8080:
			const res = await fetch('http://localhost:8080/');
			const addr = await res.text();

			let onping = (ping) => {
				console.log({ ping });
			};

			exports.connect(addr);
		}
	}

	loadWasm();
</script>

Ping PeerPiper
