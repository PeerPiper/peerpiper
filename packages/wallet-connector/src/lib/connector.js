// Connects to the opener window and relays messages between them and us via RPC.
// This connection can only be made if 1) there is window object, and 2) if there is window.opener object.
// Otherwise, rpc fails to connect.

/*
 * The connect function is called by the opened window to check and establish connection with the opener window.
 * It returns an rpc function if the connection is successful. Otherwise, it returns null.
 *
 */
export function connect() {
	if (window && window.opener) {
		return createNestedProxy();
	}
	return null;
}

/*
 * The createRpc function is called by the connect function to create an rpc function with the given window object.
 * The rpc function it returns is called by the opened window to post messages and receive responses from the opener window.
 */

async function rpc(method, params) {
	let message = { method, params };
	const channel = new MessageChannel();
	try {
		return new Promise((resolve, reject) => {
			channel.port1.onmessage = (event) => {
				if (event.data.error) {
					reject(event.data.error);
				} else {
					resolve(event.data.result);
				}
			};
			window.opener.postMessage(message, '*', [channel.port2]);
		});
	} catch (e) {
		console.log(`rpc [fail] ${method} ${e}`);
		return { error: { message: `${e}` } };
	}
}

/**
 * Use a new Proxy to make using the rpc function more convenient.
 * This way, we can call the rpc function directly as if it were a local function.
 */
function createNestedProxy(path = '') {
	return new Proxy(function () {}, {
		get(target, prop) {
			const newPath = path ? `${path}.${prop}` : prop;
			return createNestedProxy(newPath);
		},

		apply(target, thisArg, args) {
			// Use the rpc function for the final call
			return rpc(path, args);
		}
	});
}
