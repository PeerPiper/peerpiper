class ComponentError extends Error {
	constructor(value) {
		const enumerable = typeof value !== 'string';
		super(enumerable ? `${String(value)} (see error.payload)` : value);
		Object.defineProperty(this, 'payload', { value, enumerable });
	}
}

let dv = new DataView(new ArrayBuffer());
const dataView = (mem) => (dv.buffer === mem.buffer ? dv : (dv = new DataView(mem.buffer)));

const emptyFunc = () => {};

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
let _fs;
async function fetchCompile(url) {
	if (isNode) {
		_fs = _fs || (await import('fs/promises'));
		return WebAssembly.compile(await _fs.readFile(url));
	}
	return fetch(url).then(WebAssembly.compileStreaming);
}

const instantiateCore = WebAssembly.instantiate;

const resourceHandleSymbol = Symbol('resource');

const symbolDispose = Symbol.dispose || Symbol.for('dispose');

function throwUninitialized() {
	throw new TypeError('Wasm uninitialized use `await $init` first');
}

function toUint32(val) {
	return val >>> 0;
}

const utf8Decoder = new TextDecoder();

const utf8Encoder = new TextEncoder();

let utf8EncodedLen = 0;
function utf8Encode(s, realloc, memory) {
	if (typeof s !== 'string') throw new TypeError('expected a string');
	if (s.length === 0) {
		utf8EncodedLen = 0;
		return 1;
	}
	let allocLen = 0;
	let ptr = 0;
	let writtenTotal = 0;
	while (s.length > 0) {
		ptr = realloc(ptr, allocLen, 1, (allocLen += s.length * 2));
		const { read, written } = utf8Encoder.encodeInto(
			s,
			new Uint8Array(memory.buffer, ptr + writtenTotal, allocLen - writtenTotal)
		);
		writtenTotal += written;
		s = s.slice(read);
	}
	utf8EncodedLen = writtenTotal;
	return ptr;
}

let exports0;
let memory0;
let realloc0;
let postReturn0;
let postReturn1;
let postReturn2;
let postReturn3;
function trampoline0(rep) {
	const handle = handleCnt0++;
	handleTable0.set(handle, { rep, own: true });
	return handle;
}
function trampoline1(handle) {
	const handleEntry = handleTable0.get(handle);
	if (!handleEntry) {
		throw new Error(`Resource error: Invalid handle ${handle}`);
	}
	handleTable0.delete(handle);
}

class Graph {
	constructor() {
		if (!_initialized) throwUninitialized();
		const ret = exports0['wasmbuilder-app:graph/provider#[constructor]graph']();
		var handle1 = ret;
		var rsc0 = new.target === Graph ? this : Object.create(Graph.prototype);
		var rep2 = handleTable0.get(handle1).rep;
		Object.defineProperty(rsc0, resourceHandleSymbol, { writable: true, value: rep2 });
		finalizationRegistry0.register(rsc0, handle1, rsc0);
		Object.defineProperty(rsc0, symbolDispose, { writable: true, value: function () {} });

		handleTable0.delete(handle1);
		return rsc0;
	}
}

Graph.prototype.addComponent = function addComponent(arg1, arg2) {
	if (!_initialized) throwUninitialized();
	var handle0 = this[resourceHandleSymbol];
	if (handle0 === null) {
		throw new Error('Resource error: "Graph" lifetime expired.');
	}
	if (handle0 === undefined) {
		throw new Error('Resource error: Not a valid "Graph" resource.');
	}

	var ptr1 = utf8Encode(arg1, realloc0, memory0);
	var len1 = utf8EncodedLen;
	var val2 = arg2;
	var len2 = val2.byteLength;
	var ptr2 = realloc0(0, 0, 1, len2 * 1);
	var src2 = new Uint8Array(val2.buffer || val2, val2.byteOffset, len2 * 1);
	new Uint8Array(memory0.buffer, ptr2, len2 * 1).set(src2);
	const ret = exports0['wasmbuilder-app:graph/provider#[method]graph.add-component'](
		handle0,
		ptr1,
		len1,
		ptr2,
		len2
	);
	if (handleTable0.get(handle0)) {
		throw new Error('Resource error: borrows were not dropped');
	}
	let variant12;
	switch (dataView(memory0).getUint8(ret + 0, true)) {
		case 0: {
			var ptr3 = dataView(memory0).getInt32(ret + 8, true);
			var len3 = dataView(memory0).getInt32(ret + 12, true);
			var result3 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr3, len3));
			var len6 = dataView(memory0).getInt32(ret + 20, true);
			var base6 = dataView(memory0).getInt32(ret + 16, true);
			var result6 = [];
			for (let i = 0; i < len6; i++) {
				const base = base6 + i * 12;
				var ptr4 = dataView(memory0).getInt32(base + 0, true);
				var len4 = dataView(memory0).getInt32(base + 4, true);
				var result4 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr4, len4));
				let enum5;
				switch (dataView(memory0).getUint8(base + 8, true)) {
					case 0: {
						enum5 = 'module';
						break;
					}
					case 1: {
						enum5 = 'function';
						break;
					}
					case 2: {
						enum5 = 'value';
						break;
					}
					case 3: {
						enum5 = 'type';
						break;
					}
					case 4: {
						enum5 = 'instance';
						break;
					}
					case 5: {
						enum5 = 'component';
						break;
					}
					default: {
						throw new TypeError('invalid discriminant specified for ItemKind');
					}
				}
				result6.push({
					name: result4,
					kind: enum5
				});
			}
			var len9 = dataView(memory0).getInt32(ret + 28, true);
			var base9 = dataView(memory0).getInt32(ret + 24, true);
			var result9 = [];
			for (let i = 0; i < len9; i++) {
				const base = base9 + i * 12;
				var ptr7 = dataView(memory0).getInt32(base + 0, true);
				var len7 = dataView(memory0).getInt32(base + 4, true);
				var result7 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr7, len7));
				let enum8;
				switch (dataView(memory0).getUint8(base + 8, true)) {
					case 0: {
						enum8 = 'module';
						break;
					}
					case 1: {
						enum8 = 'function';
						break;
					}
					case 2: {
						enum8 = 'value';
						break;
					}
					case 3: {
						enum8 = 'type';
						break;
					}
					case 4: {
						enum8 = 'instance';
						break;
					}
					case 5: {
						enum8 = 'component';
						break;
					}
					default: {
						throw new TypeError('invalid discriminant specified for ItemKind');
					}
				}
				result9.push({
					name: result7,
					kind: enum8
				});
			}
			var ptr10 = dataView(memory0).getInt32(ret + 32, true);
			var len10 = dataView(memory0).getInt32(ret + 36, true);
			var result10 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr10, len10));
			variant12 = {
				tag: 'ok',
				val: {
					id: dataView(memory0).getInt32(ret + 4, true) >>> 0,
					name: result3,
					imports: result6,
					exports: result9,
					wit: result10
				}
			};
			break;
		}
		case 1: {
			var ptr11 = dataView(memory0).getInt32(ret + 4, true);
			var len11 = dataView(memory0).getInt32(ret + 8, true);
			var result11 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr11, len11));
			variant12 = {
				tag: 'err',
				val: result11
			};
			break;
		}
		default: {
			throw new TypeError('invalid variant discriminant for expected');
		}
	}
	postReturn0(ret);
	if (variant12.tag === 'err') {
		throw new ComponentError(variant12.val);
	}
	return variant12.val;
};

Graph.prototype.instantiateComponent = function instantiateComponent(arg1) {
	if (!_initialized) throwUninitialized();
	var handle0 = this[resourceHandleSymbol];
	if (handle0 === null) {
		throw new Error('Resource error: "Graph" lifetime expired.');
	}
	if (handle0 === undefined) {
		throw new Error('Resource error: Not a valid "Graph" resource.');
	}

	const ret = exports0['wasmbuilder-app:graph/provider#[method]graph.instantiate-component'](
		handle0,
		toUint32(arg1)
	);
	if (handleTable0.get(handle0)) {
		throw new Error('Resource error: borrows were not dropped');
	}
	let variant2;
	switch (dataView(memory0).getUint8(ret + 0, true)) {
		case 0: {
			variant2 = {
				tag: 'ok',
				val: dataView(memory0).getInt32(ret + 4, true) >>> 0
			};
			break;
		}
		case 1: {
			var ptr1 = dataView(memory0).getInt32(ret + 4, true);
			var len1 = dataView(memory0).getInt32(ret + 8, true);
			var result1 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr1, len1));
			variant2 = {
				tag: 'err',
				val: result1
			};
			break;
		}
		default: {
			throw new TypeError('invalid variant discriminant for expected');
		}
	}
	postReturn1(ret);
	if (variant2.tag === 'err') {
		throw new ComponentError(variant2.val);
	}
	return variant2.val;
};

Graph.prototype.connectInstances = function connectInstances(arg1, arg2, arg3, arg4) {
	if (!_initialized) throwUninitialized();
	var handle0 = this[resourceHandleSymbol];
	if (handle0 === null) {
		throw new Error('Resource error: "Graph" lifetime expired.');
	}
	if (handle0 === undefined) {
		throw new Error('Resource error: Not a valid "Graph" resource.');
	}

	var variant1 = arg2;
	let variant1_0;
	let variant1_1;
	if (variant1 === null || variant1 === undefined) {
		variant1_0 = 0;
		variant1_1 = 0;
	} else {
		const e = variant1;
		variant1_0 = 1;
		variant1_1 = toUint32(e);
	}
	const ret = exports0['wasmbuilder-app:graph/provider#[method]graph.connect-instances'](
		handle0,
		toUint32(arg1),
		variant1_0,
		variant1_1,
		toUint32(arg3),
		toUint32(arg4)
	);
	if (handleTable0.get(handle0)) {
		throw new Error('Resource error: borrows were not dropped');
	}
	let variant3;
	switch (dataView(memory0).getUint8(ret + 0, true)) {
		case 0: {
			variant3 = {
				tag: 'ok',
				val: undefined
			};
			break;
		}
		case 1: {
			var ptr2 = dataView(memory0).getInt32(ret + 4, true);
			var len2 = dataView(memory0).getInt32(ret + 8, true);
			var result2 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr2, len2));
			variant3 = {
				tag: 'err',
				val: result2
			};
			break;
		}
		default: {
			throw new TypeError('invalid variant discriminant for expected');
		}
	}
	postReturn1(ret);
	if (variant3.tag === 'err') {
		throw new ComponentError(variant3.val);
	}
	return variant3.val;
};

Graph.prototype.removeComponent = function removeComponent(arg1) {
	if (!_initialized) throwUninitialized();
	var handle0 = this[resourceHandleSymbol];
	if (handle0 === null) {
		throw new Error('Resource error: "Graph" lifetime expired.');
	}
	if (handle0 === undefined) {
		throw new Error('Resource error: Not a valid "Graph" resource.');
	}

	exports0['wasmbuilder-app:graph/provider#[method]graph.remove-component'](
		handle0,
		toUint32(arg1)
	);
	if (handleTable0.get(handle0)) {
		throw new Error('Resource error: borrows were not dropped');
	}
};

Graph.prototype.removeInstance = function removeInstance(arg1) {
	if (!_initialized) throwUninitialized();
	var handle0 = this[resourceHandleSymbol];
	if (handle0 === null) {
		throw new Error('Resource error: "Graph" lifetime expired.');
	}
	if (handle0 === undefined) {
		throw new Error('Resource error: Not a valid "Graph" resource.');
	}

	exports0['wasmbuilder-app:graph/provider#[method]graph.remove-instance'](handle0, toUint32(arg1));
	if (handleTable0.get(handle0)) {
		throw new Error('Resource error: borrows were not dropped');
	}
};

Graph.prototype.disconnectInstances = function disconnectInstances(arg1, arg2, arg3) {
	if (!_initialized) throwUninitialized();
	var handle0 = this[resourceHandleSymbol];
	if (handle0 === null) {
		throw new Error('Resource error: "Graph" lifetime expired.');
	}
	if (handle0 === undefined) {
		throw new Error('Resource error: Not a valid "Graph" resource.');
	}

	const ret = exports0['wasmbuilder-app:graph/provider#[method]graph.disconnect-instances'](
		handle0,
		toUint32(arg1),
		toUint32(arg2),
		toUint32(arg3)
	);
	if (handleTable0.get(handle0)) {
		throw new Error('Resource error: borrows were not dropped');
	}
	let variant2;
	switch (dataView(memory0).getUint8(ret + 0, true)) {
		case 0: {
			variant2 = {
				tag: 'ok',
				val: undefined
			};
			break;
		}
		case 1: {
			var ptr1 = dataView(memory0).getInt32(ret + 4, true);
			var len1 = dataView(memory0).getInt32(ret + 8, true);
			var result1 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr1, len1));
			variant2 = {
				tag: 'err',
				val: result1
			};
			break;
		}
		default: {
			throw new TypeError('invalid variant discriminant for expected');
		}
	}
	postReturn1(ret);
	if (variant2.tag === 'err') {
		throw new ComponentError(variant2.val);
	}
	return variant2.val;
};

Graph.prototype.printGraph = function printGraph() {
	if (!_initialized) throwUninitialized();
	var handle0 = this[resourceHandleSymbol];
	if (handle0 === null) {
		throw new Error('Resource error: "Graph" lifetime expired.');
	}
	if (handle0 === undefined) {
		throw new Error('Resource error: Not a valid "Graph" resource.');
	}

	const ret = exports0['wasmbuilder-app:graph/provider#[method]graph.print-graph'](handle0);
	if (handleTable0.get(handle0)) {
		throw new Error('Resource error: borrows were not dropped');
	}
	var ptr1 = dataView(memory0).getInt32(ret + 0, true);
	var len1 = dataView(memory0).getInt32(ret + 4, true);
	var result1 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr1, len1));
	postReturn2(ret);
	return result1;
};

Graph.prototype.encodeGraph = function encodeGraph(arg1) {
	if (!_initialized) throwUninitialized();
	var handle0 = this[resourceHandleSymbol];
	if (handle0 === null) {
		throw new Error('Resource error: "Graph" lifetime expired.');
	}
	if (handle0 === undefined) {
		throw new Error('Resource error: Not a valid "Graph" resource.');
	}

	var { defineComponents: v1_0, export: v1_1, validate: v1_2 } = arg1;
	var variant2 = v1_1;
	let variant2_0;
	let variant2_1;
	if (variant2 === null || variant2 === undefined) {
		variant2_0 = 0;
		variant2_1 = 0;
	} else {
		const e = variant2;
		variant2_0 = 1;
		variant2_1 = toUint32(e);
	}
	const ret = exports0['wasmbuilder-app:graph/provider#[method]graph.encode-graph'](
		handle0,
		v1_0 ? 1 : 0,
		variant2_0,
		variant2_1,
		v1_2 ? 1 : 0
	);
	if (handleTable0.get(handle0)) {
		throw new Error('Resource error: borrows were not dropped');
	}
	let variant5;
	switch (dataView(memory0).getUint8(ret + 0, true)) {
		case 0: {
			var ptr3 = dataView(memory0).getInt32(ret + 4, true);
			var len3 = dataView(memory0).getInt32(ret + 8, true);
			var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
			variant5 = {
				tag: 'ok',
				val: result3
			};
			break;
		}
		case 1: {
			var ptr4 = dataView(memory0).getInt32(ret + 4, true);
			var len4 = dataView(memory0).getInt32(ret + 8, true);
			var result4 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr4, len4));
			variant5 = {
				tag: 'err',
				val: result4
			};
			break;
		}
		default: {
			throw new TypeError('invalid variant discriminant for expected');
		}
	}
	postReturn3(ret);
	if (variant5.tag === 'err') {
		throw new ComponentError(variant5.val);
	}
	return variant5.val;
};
const handleTable0 = new Map();
let handleCnt0 = 0;
const finalizationRegistry0 = new FinalizationRegistry((handle) => {
	const handleEntry = handleTable0.get(handle);
	if (handleEntry) {
		handleTable0.delete(handle);
	}
});

let _initialized = false;
export const $init = (async () => {
	const module0 = fetchCompile(new URL('./graph.core.wasm', import.meta.url));
	({ exports: exports0 } = await instantiateCore(await module0, {
		'[export]wasmbuilder-app:graph/provider': {
			'[resource-drop]graph': trampoline1,
			'[resource-new]graph': trampoline0
		}
	}));
	memory0 = exports0.memory;
	realloc0 = exports0.cabi_realloc;
	postReturn0 = exports0['cabi_post_wasmbuilder-app:graph/provider#[method]graph.add-component'];
	postReturn1 =
		exports0['cabi_post_wasmbuilder-app:graph/provider#[method]graph.connect-instances'];
	postReturn2 = exports0['cabi_post_wasmbuilder-app:graph/provider#[method]graph.print-graph'];
	postReturn3 = exports0['cabi_post_wasmbuilder-app:graph/provider#[method]graph.encode-graph'];
	_initialized = true;
})();
const provider = {
	Graph: Graph
};

export { provider };
