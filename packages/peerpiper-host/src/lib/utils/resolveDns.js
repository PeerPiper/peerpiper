// Resolves dnsaddr to multiaddr
import { multiaddr, resolvers } from '@multiformats/multiaddr';
import { dnsaddrResolver } from '@multiformats/multiaddr/resolvers';

resolvers.set('dnsaddr', dnsaddrResolver);

/**
 * Resolves a dnsaddr string to a multiaddr array
 * @param {string} dnsaddrString - The dnsaddr string to resolve, example: /dnsaddr/ipfs.io
 * @returns {Array} - An array of multiaddrs
 * @throws {Error} - Throws an error if the dnsaddr cannot be resolved
 * @example
 * const dnsaddrString = '/dnsaddr/ipfs.io';
 * const multiaddrs = await resolveDnsaddr(dnsaddrString);
 */
export async function resolveDnsaddr(dnsaddrString) {
	try {
		// Parse the dnsaddr string into a multiaddr
		const ma = multiaddr(dnsaddrString);

		const resolved = await ma.resolve({
			signal: AbortSignal.timeout(5000)
		});

		// Convert the resolved multiaddr to a toString() array
		let maArrayStrings = resolved.map((ma) => ma.toString());

		return maArrayStrings;
	} catch (err) {
		console.error('Error resolving dnsaddr:', err);
		throw err;
	}
}
