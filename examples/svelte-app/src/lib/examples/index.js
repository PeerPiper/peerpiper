import { default as Basic } from './Basic.svelte';
import { default as Wallet } from './Wallet.svelte';

export const examples = [
	{ name: 'Basic Ping with Server (start server first)', component: Basic },
	{ name: 'Wallet', component: Wallet }
];

export * as importables from './importables.js';
