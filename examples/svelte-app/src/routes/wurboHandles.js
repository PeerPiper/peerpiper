// To satisfy the Wurbo API we need to implement a handle to a function called "addeventlistener"
// We could use imports, but that would add a bundling step to this workflow
export function addeventlistener({ selector, ty, value }) {
	const bc = new BroadcastChannel('listener_updates'); // defined in Wurbo
	let elem = document.querySelector(selector);
	document.querySelector(selector).addEventListener(ty, (e) => {
		bc.postMessage(window.wurbo.render(e.target.value)); // defined in Wurbo
	});
}
