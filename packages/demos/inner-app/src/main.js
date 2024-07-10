import './app.css';
import '../../../../submodules/seed-keeper/crates/seed-keeper-wit-ui/output.css';
import App from './App.svelte';

const app = new App({
	target: document.getElementById('integrity-wallet-app')
});

export default app;
