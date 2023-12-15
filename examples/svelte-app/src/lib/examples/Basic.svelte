<script>
	// A basic call to the peerpiper wasm-bindgen API to ping and show pings.
	import peerpiper from '../../../../../crates/peerpiper-browser/Cargo.toml';

	let addr =
		'/ip4/10.0.0.140/udp/54417/webrtc-direct/certhash/uEiC475YhqnPWLCICwineVXbCsKnFNvswSo8yfY3v_x6M9g/p2p/12D3KooWRtoqvhY4Q4g7qDx5oLc3CPZwj88mJSQmuw6ebBiez8SS';

	async function loadWasm() {
		if (!import.meta.env.SSR) {
			// This code will only run in the browser
			const exports = await peerpiper();

			// Use functions which were exported from Rust...
			console.log({ exports });

			exports.start_peerpiper(addr);
		}
	}

	loadWasm();
</script>

Ping PeerPiper
