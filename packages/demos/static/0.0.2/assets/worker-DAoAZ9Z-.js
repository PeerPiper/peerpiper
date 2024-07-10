var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var _stream, _entry, _mtime, _a;
function sleep(ms2) {
  return new Promise((fulfil) => {
    setTimeout(fulfil, ms2);
  });
}
let packagesUrl = "https://unpkg.com";
const fetch_cache = /* @__PURE__ */ new Map();
async function fetch_if_uncached(url) {
  if (fetch_cache.has(url)) {
    return fetch_cache.get(url);
  }
  await sleep(200);
  const promise = fetch(url).then(async (r2) => {
    if (r2.ok) {
      return {
        url: r2.url,
        body: await r2.text()
      };
    }
    throw new Error(await r2.text());
  }).catch((err) => {
    fetch_cache.delete(url);
    throw err;
  });
  fetch_cache.set(url, promise);
  return promise;
}
async function follow_redirects(url) {
  const res = await fetch_if_uncached(url);
  return res.url;
}
const decoder = new TextDecoder();
const plugin = (files) => ({
  name: "loader",
  async resolveId(importee, importer) {
    if (files.find((file) => file[0] == importee)) {
      return importee;
    }
    if (importee.endsWith("/"))
      importee = importee.slice(0, -1);
    if (importee.startsWith("http:") || importee.startsWith("https:"))
      return importee;
    if (importee.startsWith(".")) {
      const url = new URL(importee, importer).href;
      return await follow_redirects(url);
    } else {
      try {
        const pkg_url = await follow_redirects(`${packagesUrl}/${importee}/package.json`);
        const pkg_json = (await fetch_if_uncached(pkg_url)).body;
        const pkg = JSON.parse(pkg_json);
        if (pkg.svelte || pkg.module || pkg.main) {
          const url = pkg_url.replace(/\/package\.json$/, "");
          return new URL(pkg.svelte || pkg.module || pkg.main, `${url}/`).href;
        }
      } catch (err) {
      }
      return await follow_redirects(`${packagesUrl}/${importee}`);
    }
  },
  async load(id2) {
    let match = files.find((file) => file[0] == id2);
    if (match) {
      if (typeof match[1] === "string")
        return match[1];
      return decoder.decode(match[1]);
    }
    const res = await fetch_if_uncached(id2);
    return res.body;
  },
  async transform(code, id2) {
    if (!id2.endsWith(".js"))
      return;
    let matches = code.match(/new URL\((.*)/g);
    if (!matches || !matches.length)
      return;
    matches.forEach((match) => {
      let fileName = match.match(/'.\/(.*)'/)[1];
      if (!fileName.endsWith(".wasm"))
        return;
      let found = files.find((file) => file[0] == fileName);
      if (!found)
        return;
      let wasmBlobUrl = URL.createObjectURL(new Blob([found[1]], { type: "application/wasm" }));
      if (!wasmBlobUrl || wasmBlobUrl == "undefined")
        return;
      code = code.replace(`new URL('./${fileName}', import.meta.url)`, `'${wasmBlobUrl}'`);
    });
    return {
      code,
      map: { mappings: "" }
      // TODO: use https://github.com/Rich-Harris/magic-string
    };
  }
});
let id = 0;
const symbolDispose$2 = Symbol.dispose || Symbol.for("dispose");
const IoError = class Error2 {
  constructor(msg) {
    this.msg = msg;
  }
  toDebugString() {
    return this.msg;
  }
};
let InputStream$3 = class InputStream {
  /**
   * @param {InputStreamHandler} handler
   */
  constructor(handler) {
    if (!handler)
      console.trace("no handler");
    this.id = ++id;
    this.handler = handler;
  }
  read(len) {
    if (this.handler.read)
      return this.handler.read(len);
    return this.handler.blockingRead.call(this, len);
  }
  blockingRead(len) {
    return this.handler.blockingRead.call(this, len);
  }
  skip(len) {
    if (this.handler.skip)
      return this.handler.skip.call(this, len);
    if (this.handler.read) {
      const bytes = this.handler.read.call(this, len);
      return BigInt(bytes.byteLength);
    }
    return this.blockingSkip.call(this, len);
  }
  blockingSkip(len) {
    if (this.handler.blockingSkip)
      return this.handler.blockingSkip.call(this, len);
    const bytes = this.handler.blockingRead.call(this, len);
    return BigInt(bytes.byteLength);
  }
  subscribe() {
    console.log(`[streams] Subscribe to input stream ${this.id}`);
  }
  [symbolDispose$2]() {
    if (this.handler.drop)
      this.handler.drop.call(this);
  }
};
let OutputStream$3 = class OutputStream {
  /**
   * @param {OutputStreamHandler} handler
   */
  constructor(handler) {
    if (!handler)
      console.trace("no handler");
    this.id = ++id;
    this.open = true;
    this.handler = handler;
  }
  checkWrite(len) {
    if (!this.open)
      return 0n;
    if (this.handler.checkWrite)
      return this.handler.checkWrite.call(this, len);
    return 1000000n;
  }
  write(buf) {
    this.handler.write.call(this, buf);
  }
  blockingWriteAndFlush(buf) {
    this.handler.write.call(this, buf);
  }
  flush() {
    if (this.handler.flush)
      this.handler.flush.call(this);
  }
  blockingFlush() {
    this.open = true;
  }
  writeZeroes(len) {
    this.write.call(this, new Uint8Array(Number(len)));
  }
  blockingWriteZeroes(len) {
    this.blockingWrite.call(this, new Uint8Array(Number(len)));
  }
  blockingWriteZeroesAndFlush(len) {
    this.blockingWriteAndFlush.call(this, new Uint8Array(Number(len)));
  }
  splice(src, len) {
    const spliceLen = Math.min(len, this.checkWrite.call(this));
    const bytes = src.read(spliceLen);
    this.write.call(this, bytes);
    return bytes.byteLength;
  }
  blockingSplice(_src, _len) {
    console.log(`[streams] Blocking splice ${this.id}`);
  }
  forward(_src) {
    console.log(`[streams] Forward ${this.id}`);
  }
  subscribe() {
    console.log(`[streams] Subscribe to output stream ${this.id}`);
  }
  [symbolDispose$2]() {
  }
};
const error = { Error: IoError };
const streams = { InputStream: InputStream$3, OutputStream: OutputStream$3 };
const { InputStream: InputStream$2, OutputStream: OutputStream$2 } = streams;
let _cwd$1 = null;
let _fileData = { dir: {} };
const timeZero = {
  seconds: BigInt(0),
  nanoseconds: 0
};
function getChildEntry(parentEntry, subpath, openFlags) {
  if (subpath === "." && _rootPreopen && descriptorGetEntry(_rootPreopen[0]) === parentEntry) {
    subpath = _cwd$1;
    if (subpath.startsWith("/") && subpath !== "/")
      subpath = subpath.slice(1);
  }
  let entry = parentEntry;
  let segmentIdx;
  do {
    if (!entry || !entry.dir)
      throw "not-directory";
    segmentIdx = subpath.indexOf("/");
    const segment = segmentIdx === -1 ? subpath : subpath.slice(0, segmentIdx);
    if (segment === "..")
      throw "no-entry";
    if (segment === "." || segment === "")
      ;
    else if (!entry.dir[segment] && openFlags.create)
      entry = entry.dir[segment] = openFlags.directory ? { dir: {} } : { source: new Uint8Array([]) };
    else
      entry = entry.dir[segment];
    subpath = subpath.slice(segmentIdx + 1);
  } while (segmentIdx !== -1);
  if (!entry)
    throw "no-entry";
  return entry;
}
function getSource(fileEntry) {
  if (typeof fileEntry.source === "string") {
    fileEntry.source = new TextEncoder().encode(fileEntry.source);
  }
  return fileEntry.source;
}
let DirectoryEntryStream$1 = class DirectoryEntryStream {
  constructor(entries) {
    this.idx = 0;
    this.entries = entries;
  }
  readDirectoryEntry() {
    if (this.idx === this.entries.length)
      return null;
    const [name, entry] = this.entries[this.idx];
    this.idx += 1;
    return {
      name,
      type: entry.dir ? "directory" : "regular-file"
    };
  }
};
let Descriptor$1 = (_a = class {
  constructor(entry, isStream) {
    __privateAdd(this, _stream, void 0);
    __privateAdd(this, _entry, void 0);
    __privateAdd(this, _mtime, 0);
    if (isStream)
      __privateSet(this, _stream, entry);
    else
      __privateSet(this, _entry, entry);
  }
  _getEntry(descriptor) {
    return __privateGet(descriptor, _entry);
  }
  readViaStream(_offset) {
    const source = getSource(__privateGet(this, _entry));
    let offset = Number(_offset);
    return new InputStream$2({
      blockingRead(len) {
        if (offset === source.byteLength)
          throw { tag: "closed" };
        const bytes = source.slice(offset, offset + Number(len));
        offset += bytes.byteLength;
        return bytes;
      }
    });
  }
  writeViaStream(_offset) {
    const entry = __privateGet(this, _entry);
    let offset = Number(_offset);
    return new OutputStream$2({
      write(buf) {
        const newSource = new Uint8Array(buf.byteLength + entry.source.byteLength);
        newSource.set(entry.source, 0);
        newSource.set(buf, offset);
        offset += buf.byteLength;
        entry.source = newSource;
        return buf.byteLength;
      }
    });
  }
  appendViaStream() {
    console.log(`[filesystem] APPEND STREAM`);
  }
  advise(descriptor, offset, length, advice) {
    console.log(`[filesystem] ADVISE`, descriptor, offset, length, advice);
  }
  syncData() {
    console.log(`[filesystem] SYNC DATA`);
  }
  getFlags() {
    console.log(`[filesystem] FLAGS FOR`);
  }
  getType() {
    if (__privateGet(this, _stream))
      return "fifo";
    if (__privateGet(this, _entry).dir)
      return "directory";
    if (__privateGet(this, _entry).source)
      return "regular-file";
    return "unknown";
  }
  setSize(size) {
    console.log(`[filesystem] SET SIZE`, size);
  }
  setTimes(dataAccessTimestamp, dataModificationTimestamp) {
    console.log(`[filesystem] SET TIMES`, dataAccessTimestamp, dataModificationTimestamp);
  }
  read(length, offset) {
    const source = getSource(__privateGet(this, _entry));
    return [source.slice(offset, offset + length), offset + length >= source.byteLength];
  }
  write(buffer, offset) {
    if (offset !== 0)
      throw "invalid-seek";
    __privateGet(this, _entry).source = buffer;
    return buffer.byteLength;
  }
  readDirectory() {
    var _a3;
    if (!((_a3 = __privateGet(this, _entry)) == null ? void 0 : _a3.dir))
      throw "bad-descriptor";
    return new DirectoryEntryStream$1(Object.entries(__privateGet(this, _entry).dir).sort(([a2], [b2]) => a2 > b2 ? 1 : -1));
  }
  sync() {
    console.log(`[filesystem] SYNC`);
  }
  createDirectoryAt(path) {
    const entry = getChildEntry(__privateGet(this, _entry), path, { create: true, directory: true });
    if (entry.source)
      throw "exist";
  }
  stat() {
    let type = "unknown", size = BigInt(0);
    if (__privateGet(this, _entry).source) {
      type = "regular-file";
      const source = getSource(__privateGet(this, _entry));
      size = BigInt(source.byteLength);
    } else if (__privateGet(this, _entry).dir) {
      type = "directory";
    }
    return {
      type,
      linkCount: BigInt(0),
      size,
      dataAccessTimestamp: timeZero,
      dataModificationTimestamp: timeZero,
      statusChangeTimestamp: timeZero
    };
  }
  statAt(_pathFlags, path) {
    const entry = getChildEntry(__privateGet(this, _entry), path);
    let type = "unknown", size = BigInt(0);
    if (entry.source) {
      type = "regular-file";
      const source = getSource(entry);
      size = BigInt(source.byteLength);
    } else if (entry.dir) {
      type = "directory";
    }
    return {
      type,
      linkCount: BigInt(0),
      size,
      dataAccessTimestamp: timeZero,
      dataModificationTimestamp: timeZero,
      statusChangeTimestamp: timeZero
    };
  }
  setTimesAt() {
    console.log(`[filesystem] SET TIMES AT`);
  }
  linkAt() {
    console.log(`[filesystem] LINK AT`);
  }
  openAt(_pathFlags, path, openFlags, _descriptorFlags, _modes) {
    const childEntry = getChildEntry(__privateGet(this, _entry), path, openFlags);
    return new _a(childEntry);
  }
  readlinkAt() {
    console.log(`[filesystem] READLINK AT`);
  }
  removeDirectoryAt() {
    console.log(`[filesystem] REMOVE DIR AT`);
  }
  renameAt() {
    console.log(`[filesystem] RENAME AT`);
  }
  symlinkAt() {
    console.log(`[filesystem] SYMLINK AT`);
  }
  unlinkFileAt() {
    console.log(`[filesystem] UNLINK FILE AT`);
  }
  isSameObject(other) {
    return other === this;
  }
  metadataHash() {
    let upper = BigInt(0);
    upper += BigInt(__privateGet(this, _mtime));
    return { upper, lower: BigInt(0) };
  }
  metadataHashAt(_pathFlags, _path) {
    let upper = BigInt(0);
    upper += BigInt(__privateGet(this, _mtime));
    return { upper, lower: BigInt(0) };
  }
}, _stream = new WeakMap(), _entry = new WeakMap(), _mtime = new WeakMap(), _a);
const descriptorGetEntry = Descriptor$1.prototype._getEntry;
delete Descriptor$1.prototype._getEntry;
let _preopens = [[new Descriptor$1(_fileData), "/"]], _rootPreopen = _preopens[0];
const preopens = {
  getDirectories() {
    return _preopens;
  }
};
const types = {
  Descriptor: Descriptor$1,
  DirectoryEntryStream: DirectoryEntryStream$1
};
const { InputStream: InputStream$1, OutputStream: OutputStream$1 } = streams;
const symbolDispose$1 = Symbol.dispose ?? Symbol.for("dispose");
let _env = [], _args = [], _cwd = null;
const environment = {
  getEnvironment() {
    return _env;
  },
  getArguments() {
    return _args;
  },
  initialCwd() {
    return _cwd;
  }
};
class ComponentExit extends Error {
  constructor(ok) {
    super(`Component exited ${ok ? "successfully" : "with error"}`);
    this.exitError = true;
    this.ok = ok;
  }
}
const exit$1 = {
  exit(status) {
    throw new ComponentExit(status.tag === "err" ? true : false);
  }
};
const stdinStream = new InputStream$1({
  blockingRead(_len) {
  },
  subscribe() {
  },
  [symbolDispose$1]() {
  }
});
let textDecoder = new TextDecoder();
const stdoutStream = new OutputStream$1({
  write(contents) {
    console.log(textDecoder.decode(contents));
  },
  blockingFlush() {
  },
  [symbolDispose$1]() {
  }
});
const stderrStream = new OutputStream$1({
  write(contents) {
    console.error(textDecoder.decode(contents));
  },
  blockingFlush() {
  },
  [symbolDispose$1]() {
  }
});
const stdin = {
  InputStream: InputStream$1,
  getStdin() {
    return stdinStream;
  }
};
const stdout = {
  OutputStream: OutputStream$1,
  getStdout() {
    return stdoutStream;
  }
};
const stderr = {
  OutputStream: OutputStream$1,
  getStderr() {
    return stderrStream;
  }
};
let TerminalInput$1 = class TerminalInput {
};
let TerminalOutput$1 = class TerminalOutput {
};
const terminalStdoutInstance = new TerminalOutput$1();
const terminalStderrInstance = new TerminalOutput$1();
const terminalStdinInstance = new TerminalInput$1();
const terminalInput = {
  TerminalInput: TerminalInput$1
};
const terminalOutput = {
  TerminalOutput: TerminalOutput$1
};
const terminalStderr = {
  TerminalOutput: TerminalOutput$1,
  getTerminalStderr() {
    return terminalStderrInstance;
  }
};
const terminalStdin = {
  TerminalInput: TerminalInput$1,
  getTerminalStdin() {
    return terminalStdinInstance;
  }
};
const terminalStdout = {
  TerminalOutput: TerminalOutput$1,
  getTerminalStdout() {
    return terminalStdoutInstance;
  }
};
const MAX_BYTES = 65536;
let insecureRandomValue1, insecureRandomValue2;
const random = {
  getRandomBytes(len) {
    const bytes = new Uint8Array(Number(len));
    if (len > MAX_BYTES) {
      for (var generated = 0; generated < len; generated += MAX_BYTES) {
        crypto.getRandomValues(bytes.subarray(generated, generated + MAX_BYTES));
      }
    } else {
      crypto.getRandomValues(bytes);
    }
    return bytes;
  },
  getRandomU64() {
    return crypto.getRandomValues(new BigUint64Array(1))[0];
  },
  insecureRandom() {
    if (insecureRandomValue1 === void 0) {
      insecureRandomValue1 = random.getRandomU64();
      insecureRandomValue2 = random.getRandomU64();
    }
    return [insecureRandomValue1, insecureRandomValue2];
  }
};
const { getEnvironment } = environment;
const { exit } = exit$1;
const { getStderr } = stderr;
const { getStdin } = stdin;
const { getStdout } = stdout;
const { TerminalInput: TerminalInput2 } = terminalInput;
const { TerminalOutput: TerminalOutput2 } = terminalOutput;
const { getTerminalStderr } = terminalStderr;
const { getTerminalStdin } = terminalStdin;
const { getTerminalStdout } = terminalStdout;
const { getDirectories } = preopens;
const {
  Descriptor,
  DirectoryEntryStream: DirectoryEntryStream2,
  filesystemErrorCode
} = types;
const { Error: Error$1 } = error;
const {
  InputStream: InputStream2,
  OutputStream: OutputStream2
} = streams;
const { getRandomBytes } = random;
const base64Compile = (str) => WebAssembly.compile(typeof Buffer !== "undefined" ? Buffer.from(str, "base64") : Uint8Array.from(atob(str), (b2) => b2.charCodeAt(0)));
class ComponentError extends Error {
  constructor(value) {
    const enumerable = typeof value !== "string";
    super(enumerable ? `${String(value)} (see error.payload)` : value);
    Object.defineProperty(this, "payload", { value, enumerable });
  }
}
let curResourceBorrows = [];
let dv = new DataView(new ArrayBuffer());
const dataView = (mem) => dv.buffer === mem.buffer ? dv : dv = new DataView(mem.buffer);
const isNode = typeof process !== "undefined" && process.versions && process.versions.node;
let _fs;
async function fetchCompile(url) {
  if (isNode) {
    _fs = _fs || await import("./__vite-browser-external-Dhvy_jtL.js");
    return WebAssembly.compile(await _fs.readFile(url));
  }
  return fetch(url).then(WebAssembly.compileStreaming);
}
function getErrorPayload(e4) {
  if (e4 && hasOwnProperty.call(e4, "payload"))
    return e4.payload;
  if (e4 instanceof Error)
    throw e4;
  return e4;
}
const hasOwnProperty = Object.prototype.hasOwnProperty;
const instantiateCore = WebAssembly.instantiate;
const T_FLAG = 1 << 30;
function rscTableCreateOwn(table, rep) {
  const free = table[0] & ~T_FLAG;
  if (free === 0) {
    table.push(0);
    table.push(rep | T_FLAG);
    return (table.length >> 1) - 1;
  }
  table[0] = table[free << 1];
  table[free << 1] = 0;
  table[(free << 1) + 1] = rep | T_FLAG;
  return free;
}
function rscTableRemove(table, handle) {
  const scope = table[handle << 1];
  const val = table[(handle << 1) + 1];
  const own = (val & T_FLAG) !== 0;
  const rep = val & ~T_FLAG;
  if (val === 0 || (scope & T_FLAG) !== 0)
    throw new TypeError("Invalid handle");
  table[handle << 1] = table[0] | T_FLAG;
  table[0] = handle | T_FLAG;
  return { rep, scope, own };
}
const symbolCabiDispose = Symbol.for("cabiDispose");
const symbolRscHandle = Symbol("handle");
const symbolRscRep = Symbol.for("cabiRep");
const symbolDispose = Symbol.dispose || Symbol.for("dispose");
function throwUninitialized() {
  throw new TypeError("Wasm uninitialized use `await $init` first");
}
const toUint64 = (val) => BigInt.asUintN(64, BigInt(val));
function toUint32(val) {
  return val >>> 0;
}
const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();
let utf8EncodedLen = 0;
function utf8Encode(s2, realloc, memory) {
  if (typeof s2 !== "string")
    throw new TypeError("expected a string");
  if (s2.length === 0) {
    utf8EncodedLen = 0;
    return 1;
  }
  let allocLen = 0;
  let ptr = 0;
  let writtenTotal = 0;
  while (s2.length > 0) {
    ptr = realloc(ptr, allocLen, 1, allocLen += s2.length * 2);
    const { read, written } = utf8Encoder.encodeInto(
      s2,
      new Uint8Array(memory.buffer, ptr + writtenTotal, allocLen - writtenTotal)
    );
    writtenTotal += written;
    s2 = s2.slice(read);
  }
  utf8EncodedLen = writtenTotal;
  return ptr;
}
let exports0;
let exports1;
const handleTable2 = [T_FLAG, 0];
const captureTable2 = /* @__PURE__ */ new Map();
let captureCnt2 = 0;
function trampoline5() {
  const ret = getStderr();
  if (!(ret instanceof OutputStream2)) {
    throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep = ret[symbolRscRep] || ++captureCnt2;
    captureTable2.set(rep, ret);
    handle0 = rscTableCreateOwn(handleTable2, rep);
  }
  return handle0;
}
function trampoline6(arg0) {
  let variant0;
  switch (arg0) {
    case 0: {
      variant0 = {
        tag: "ok",
        val: void 0
      };
      break;
    }
    case 1: {
      variant0 = {
        tag: "err",
        val: void 0
      };
      break;
    }
    default: {
      throw new TypeError("invalid variant discriminant for expected");
    }
  }
  exit(variant0);
}
const handleTable1 = [T_FLAG, 0];
const captureTable1 = /* @__PURE__ */ new Map();
let captureCnt1 = 0;
function trampoline7() {
  const ret = getStdin();
  if (!(ret instanceof InputStream2)) {
    throw new TypeError('Resource error: Not a valid "InputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep = ret[symbolRscRep] || ++captureCnt1;
    captureTable1.set(rep, ret);
    handle0 = rscTableCreateOwn(handleTable1, rep);
  }
  return handle0;
}
function trampoline8() {
  const ret = getStdout();
  if (!(ret instanceof OutputStream2)) {
    throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep = ret[symbolRscRep] || ++captureCnt2;
    captureTable2.set(rep, ret);
    handle0 = rscTableCreateOwn(handleTable2, rep);
  }
  return handle0;
}
let exports2;
let memory0;
let realloc0;
const handleTable5 = [T_FLAG, 0];
const captureTable5 = /* @__PURE__ */ new Map();
let captureCnt5 = 0;
function trampoline11(arg0) {
  const ret = getDirectories();
  var vec3 = ret;
  var len3 = vec3.length;
  var result3 = realloc0(0, 0, 4, len3 * 12);
  for (let i2 = 0; i2 < vec3.length; i2++) {
    const e4 = vec3[i2];
    const base = result3 + i2 * 12;
    var [tuple0_0, tuple0_1] = e4;
    if (!(tuple0_0 instanceof Descriptor)) {
      throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
    }
    var handle1 = tuple0_0[symbolRscHandle];
    if (!handle1) {
      const rep = tuple0_0[symbolRscRep] || ++captureCnt5;
      captureTable5.set(rep, tuple0_0);
      handle1 = rscTableCreateOwn(handleTable5, rep);
    }
    dataView(memory0).setInt32(base + 0, handle1, true);
    var ptr2 = utf8Encode(tuple0_1, realloc0, memory0);
    var len2 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 8, len2, true);
    dataView(memory0).setInt32(base + 4, ptr2, true);
  }
  dataView(memory0).setInt32(arg0 + 4, len3, true);
  dataView(memory0).setInt32(arg0 + 0, result3, true);
}
function trampoline12(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.readViaStream(BigInt.asUintN(64, arg1)) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e4 instanceof InputStream2)) {
        throw new TypeError('Resource error: Not a valid "InputStream" resource.');
      }
      var handle3 = e4[symbolRscHandle];
      if (!handle3) {
        const rep = e4[symbolRscRep] || ++captureCnt1;
        captureTable1.set(rep, e4);
        handle3 = rscTableCreateOwn(handleTable1, rep);
      }
      dataView(memory0).setInt32(arg2 + 4, handle3, true);
      break;
    }
    case "err": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var val4 = e4;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline13(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.writeViaStream(BigInt.asUintN(64, arg1)) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e4 instanceof OutputStream2)) {
        throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle3 = e4[symbolRscHandle];
      if (!handle3) {
        const rep = e4[symbolRscRep] || ++captureCnt2;
        captureTable2.set(rep, e4);
        handle3 = rscTableCreateOwn(handleTable2, rep);
      }
      dataView(memory0).setInt32(arg2 + 4, handle3, true);
      break;
    }
    case "err": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var val4 = e4;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline14(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.appendViaStream() };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e4 instanceof OutputStream2)) {
        throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle3 = e4[symbolRscHandle];
      if (!handle3) {
        const rep = e4[symbolRscRep] || ++captureCnt2;
        captureTable2.set(rep, e4);
        handle3 = rscTableCreateOwn(handleTable2, rep);
      }
      dataView(memory0).setInt32(arg1 + 4, handle3, true);
      break;
    }
    case "err": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e4;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline15(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.getType() };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var val3 = e4;
      let enum3;
      switch (val3) {
        case "unknown": {
          enum3 = 0;
          break;
        }
        case "block-device": {
          enum3 = 1;
          break;
        }
        case "character-device": {
          enum3 = 2;
          break;
        }
        case "directory": {
          enum3 = 3;
          break;
        }
        case "fifo": {
          enum3 = 4;
          break;
        }
        case "symbolic-link": {
          enum3 = 5;
          break;
        }
        case "regular-file": {
          enum3 = 6;
          break;
        }
        case "socket": {
          enum3 = 7;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val3}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum3, true);
      break;
    }
    case "err": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e4;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
const handleTable6 = [T_FLAG, 0];
const captureTable6 = /* @__PURE__ */ new Map();
let captureCnt6 = 0;
function trampoline16(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.readDirectory() };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e4 instanceof DirectoryEntryStream2)) {
        throw new TypeError('Resource error: Not a valid "DirectoryEntryStream" resource.');
      }
      var handle3 = e4[symbolRscHandle];
      if (!handle3) {
        const rep = e4[symbolRscRep] || ++captureCnt6;
        captureTable6.set(rep, e4);
        handle3 = rscTableCreateOwn(handleTable6, rep);
      }
      dataView(memory0).setInt32(arg1 + 4, handle3, true);
      break;
    }
    case "err": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e4;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline17(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.stat() };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant12 = ret;
  switch (variant12.tag) {
    case "ok": {
      const e4 = variant12.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var { type: v3_0, linkCount: v3_1, size: v3_2, dataAccessTimestamp: v3_3, dataModificationTimestamp: v3_4, statusChangeTimestamp: v3_5 } = e4;
      var val4 = v3_0;
      let enum4;
      switch (val4) {
        case "unknown": {
          enum4 = 0;
          break;
        }
        case "block-device": {
          enum4 = 1;
          break;
        }
        case "character-device": {
          enum4 = 2;
          break;
        }
        case "directory": {
          enum4 = 3;
          break;
        }
        case "fifo": {
          enum4 = 4;
          break;
        }
        case "symbolic-link": {
          enum4 = 5;
          break;
        }
        case "regular-file": {
          enum4 = 6;
          break;
        }
        case "socket": {
          enum4 = 7;
          break;
        }
        default: {
          if (v3_0 instanceof Error) {
            console.error(v3_0);
          }
          throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum4, true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v3_1), true);
      dataView(memory0).setBigInt64(arg1 + 24, toUint64(v3_2), true);
      var variant6 = v3_3;
      if (variant6 === null || variant6 === void 0) {
        dataView(memory0).setInt8(arg1 + 32, 0, true);
      } else {
        const e5 = variant6;
        dataView(memory0).setInt8(arg1 + 32, 1, true);
        var { seconds: v5_0, nanoseconds: v5_1 } = e5;
        dataView(memory0).setBigInt64(arg1 + 40, toUint64(v5_0), true);
        dataView(memory0).setInt32(arg1 + 48, toUint32(v5_1), true);
      }
      var variant8 = v3_4;
      if (variant8 === null || variant8 === void 0) {
        dataView(memory0).setInt8(arg1 + 56, 0, true);
      } else {
        const e5 = variant8;
        dataView(memory0).setInt8(arg1 + 56, 1, true);
        var { seconds: v7_0, nanoseconds: v7_1 } = e5;
        dataView(memory0).setBigInt64(arg1 + 64, toUint64(v7_0), true);
        dataView(memory0).setInt32(arg1 + 72, toUint32(v7_1), true);
      }
      var variant10 = v3_5;
      if (variant10 === null || variant10 === void 0) {
        dataView(memory0).setInt8(arg1 + 80, 0, true);
      } else {
        const e5 = variant10;
        dataView(memory0).setInt8(arg1 + 80, 1, true);
        var { seconds: v9_0, nanoseconds: v9_1 } = e5;
        dataView(memory0).setBigInt64(arg1 + 88, toUint64(v9_0), true);
        dataView(memory0).setInt32(arg1 + 96, toUint32(v9_1), true);
      }
      break;
    }
    case "err": {
      const e4 = variant12.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val11 = e4;
      let enum11;
      switch (val11) {
        case "access": {
          enum11 = 0;
          break;
        }
        case "would-block": {
          enum11 = 1;
          break;
        }
        case "already": {
          enum11 = 2;
          break;
        }
        case "bad-descriptor": {
          enum11 = 3;
          break;
        }
        case "busy": {
          enum11 = 4;
          break;
        }
        case "deadlock": {
          enum11 = 5;
          break;
        }
        case "quota": {
          enum11 = 6;
          break;
        }
        case "exist": {
          enum11 = 7;
          break;
        }
        case "file-too-large": {
          enum11 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum11 = 9;
          break;
        }
        case "in-progress": {
          enum11 = 10;
          break;
        }
        case "interrupted": {
          enum11 = 11;
          break;
        }
        case "invalid": {
          enum11 = 12;
          break;
        }
        case "io": {
          enum11 = 13;
          break;
        }
        case "is-directory": {
          enum11 = 14;
          break;
        }
        case "loop": {
          enum11 = 15;
          break;
        }
        case "too-many-links": {
          enum11 = 16;
          break;
        }
        case "message-size": {
          enum11 = 17;
          break;
        }
        case "name-too-long": {
          enum11 = 18;
          break;
        }
        case "no-device": {
          enum11 = 19;
          break;
        }
        case "no-entry": {
          enum11 = 20;
          break;
        }
        case "no-lock": {
          enum11 = 21;
          break;
        }
        case "insufficient-memory": {
          enum11 = 22;
          break;
        }
        case "insufficient-space": {
          enum11 = 23;
          break;
        }
        case "not-directory": {
          enum11 = 24;
          break;
        }
        case "not-empty": {
          enum11 = 25;
          break;
        }
        case "not-recoverable": {
          enum11 = 26;
          break;
        }
        case "unsupported": {
          enum11 = 27;
          break;
        }
        case "no-tty": {
          enum11 = 28;
          break;
        }
        case "no-such-device": {
          enum11 = 29;
          break;
        }
        case "overflow": {
          enum11 = 30;
          break;
        }
        case "not-permitted": {
          enum11 = 31;
          break;
        }
        case "pipe": {
          enum11 = 32;
          break;
        }
        case "read-only": {
          enum11 = 33;
          break;
        }
        case "invalid-seek": {
          enum11 = 34;
          break;
        }
        case "text-file-busy": {
          enum11 = 35;
          break;
        }
        case "cross-device": {
          enum11 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val11}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum11, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline18(arg0, arg1, arg2, arg3, arg4) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.statAt(flags3, result4) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant14 = ret;
  switch (variant14.tag) {
    case "ok": {
      const e4 = variant14.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      var { type: v5_0, linkCount: v5_1, size: v5_2, dataAccessTimestamp: v5_3, dataModificationTimestamp: v5_4, statusChangeTimestamp: v5_5 } = e4;
      var val6 = v5_0;
      let enum6;
      switch (val6) {
        case "unknown": {
          enum6 = 0;
          break;
        }
        case "block-device": {
          enum6 = 1;
          break;
        }
        case "character-device": {
          enum6 = 2;
          break;
        }
        case "directory": {
          enum6 = 3;
          break;
        }
        case "fifo": {
          enum6 = 4;
          break;
        }
        case "symbolic-link": {
          enum6 = 5;
          break;
        }
        case "regular-file": {
          enum6 = 6;
          break;
        }
        case "socket": {
          enum6 = 7;
          break;
        }
        default: {
          if (v5_0 instanceof Error) {
            console.error(v5_0);
          }
          throw new TypeError(`"${val6}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum6, true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v5_1), true);
      dataView(memory0).setBigInt64(arg4 + 24, toUint64(v5_2), true);
      var variant8 = v5_3;
      if (variant8 === null || variant8 === void 0) {
        dataView(memory0).setInt8(arg4 + 32, 0, true);
      } else {
        const e5 = variant8;
        dataView(memory0).setInt8(arg4 + 32, 1, true);
        var { seconds: v7_0, nanoseconds: v7_1 } = e5;
        dataView(memory0).setBigInt64(arg4 + 40, toUint64(v7_0), true);
        dataView(memory0).setInt32(arg4 + 48, toUint32(v7_1), true);
      }
      var variant10 = v5_4;
      if (variant10 === null || variant10 === void 0) {
        dataView(memory0).setInt8(arg4 + 56, 0, true);
      } else {
        const e5 = variant10;
        dataView(memory0).setInt8(arg4 + 56, 1, true);
        var { seconds: v9_0, nanoseconds: v9_1 } = e5;
        dataView(memory0).setBigInt64(arg4 + 64, toUint64(v9_0), true);
        dataView(memory0).setInt32(arg4 + 72, toUint32(v9_1), true);
      }
      var variant12 = v5_5;
      if (variant12 === null || variant12 === void 0) {
        dataView(memory0).setInt8(arg4 + 80, 0, true);
      } else {
        const e5 = variant12;
        dataView(memory0).setInt8(arg4 + 80, 1, true);
        var { seconds: v11_0, nanoseconds: v11_1 } = e5;
        dataView(memory0).setBigInt64(arg4 + 88, toUint64(v11_0), true);
        dataView(memory0).setInt32(arg4 + 96, toUint32(v11_1), true);
      }
      break;
    }
    case "err": {
      const e4 = variant14.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
      var val13 = e4;
      let enum13;
      switch (val13) {
        case "access": {
          enum13 = 0;
          break;
        }
        case "would-block": {
          enum13 = 1;
          break;
        }
        case "already": {
          enum13 = 2;
          break;
        }
        case "bad-descriptor": {
          enum13 = 3;
          break;
        }
        case "busy": {
          enum13 = 4;
          break;
        }
        case "deadlock": {
          enum13 = 5;
          break;
        }
        case "quota": {
          enum13 = 6;
          break;
        }
        case "exist": {
          enum13 = 7;
          break;
        }
        case "file-too-large": {
          enum13 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum13 = 9;
          break;
        }
        case "in-progress": {
          enum13 = 10;
          break;
        }
        case "interrupted": {
          enum13 = 11;
          break;
        }
        case "invalid": {
          enum13 = 12;
          break;
        }
        case "io": {
          enum13 = 13;
          break;
        }
        case "is-directory": {
          enum13 = 14;
          break;
        }
        case "loop": {
          enum13 = 15;
          break;
        }
        case "too-many-links": {
          enum13 = 16;
          break;
        }
        case "message-size": {
          enum13 = 17;
          break;
        }
        case "name-too-long": {
          enum13 = 18;
          break;
        }
        case "no-device": {
          enum13 = 19;
          break;
        }
        case "no-entry": {
          enum13 = 20;
          break;
        }
        case "no-lock": {
          enum13 = 21;
          break;
        }
        case "insufficient-memory": {
          enum13 = 22;
          break;
        }
        case "insufficient-space": {
          enum13 = 23;
          break;
        }
        case "not-directory": {
          enum13 = 24;
          break;
        }
        case "not-empty": {
          enum13 = 25;
          break;
        }
        case "not-recoverable": {
          enum13 = 26;
          break;
        }
        case "unsupported": {
          enum13 = 27;
          break;
        }
        case "no-tty": {
          enum13 = 28;
          break;
        }
        case "no-such-device": {
          enum13 = 29;
          break;
        }
        case "overflow": {
          enum13 = 30;
          break;
        }
        case "not-permitted": {
          enum13 = 31;
          break;
        }
        case "pipe": {
          enum13 = 32;
          break;
        }
        case "read-only": {
          enum13 = 33;
          break;
        }
        case "invalid-seek": {
          enum13 = 34;
          break;
        }
        case "text-file-busy": {
          enum13 = 35;
          break;
        }
        case "cross-device": {
          enum13 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val13}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum13, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline19(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  if ((arg4 & 4294967280) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags5 = {
    create: Boolean(arg4 & 1),
    directory: Boolean(arg4 & 2),
    exclusive: Boolean(arg4 & 4),
    truncate: Boolean(arg4 & 8)
  };
  if ((arg5 & 4294967232) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags6 = {
    read: Boolean(arg5 & 1),
    write: Boolean(arg5 & 2),
    fileIntegritySync: Boolean(arg5 & 4),
    dataIntegritySync: Boolean(arg5 & 8),
    requestedWriteSync: Boolean(arg5 & 16),
    mutateDirectory: Boolean(arg5 & 32)
  };
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.openAt(flags3, result4, flags5, flags6) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant9 = ret;
  switch (variant9.tag) {
    case "ok": {
      const e4 = variant9.val;
      dataView(memory0).setInt8(arg6 + 0, 0, true);
      if (!(e4 instanceof Descriptor)) {
        throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
      }
      var handle7 = e4[symbolRscHandle];
      if (!handle7) {
        const rep = e4[symbolRscRep] || ++captureCnt5;
        captureTable5.set(rep, e4);
        handle7 = rscTableCreateOwn(handleTable5, rep);
      }
      dataView(memory0).setInt32(arg6 + 4, handle7, true);
      break;
    }
    case "err": {
      const e4 = variant9.val;
      dataView(memory0).setInt8(arg6 + 0, 1, true);
      var val8 = e4;
      let enum8;
      switch (val8) {
        case "access": {
          enum8 = 0;
          break;
        }
        case "would-block": {
          enum8 = 1;
          break;
        }
        case "already": {
          enum8 = 2;
          break;
        }
        case "bad-descriptor": {
          enum8 = 3;
          break;
        }
        case "busy": {
          enum8 = 4;
          break;
        }
        case "deadlock": {
          enum8 = 5;
          break;
        }
        case "quota": {
          enum8 = 6;
          break;
        }
        case "exist": {
          enum8 = 7;
          break;
        }
        case "file-too-large": {
          enum8 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum8 = 9;
          break;
        }
        case "in-progress": {
          enum8 = 10;
          break;
        }
        case "interrupted": {
          enum8 = 11;
          break;
        }
        case "invalid": {
          enum8 = 12;
          break;
        }
        case "io": {
          enum8 = 13;
          break;
        }
        case "is-directory": {
          enum8 = 14;
          break;
        }
        case "loop": {
          enum8 = 15;
          break;
        }
        case "too-many-links": {
          enum8 = 16;
          break;
        }
        case "message-size": {
          enum8 = 17;
          break;
        }
        case "name-too-long": {
          enum8 = 18;
          break;
        }
        case "no-device": {
          enum8 = 19;
          break;
        }
        case "no-entry": {
          enum8 = 20;
          break;
        }
        case "no-lock": {
          enum8 = 21;
          break;
        }
        case "insufficient-memory": {
          enum8 = 22;
          break;
        }
        case "insufficient-space": {
          enum8 = 23;
          break;
        }
        case "not-directory": {
          enum8 = 24;
          break;
        }
        case "not-empty": {
          enum8 = 25;
          break;
        }
        case "not-recoverable": {
          enum8 = 26;
          break;
        }
        case "unsupported": {
          enum8 = 27;
          break;
        }
        case "no-tty": {
          enum8 = 28;
          break;
        }
        case "no-such-device": {
          enum8 = 29;
          break;
        }
        case "overflow": {
          enum8 = 30;
          break;
        }
        case "not-permitted": {
          enum8 = 31;
          break;
        }
        case "pipe": {
          enum8 = 32;
          break;
        }
        case "read-only": {
          enum8 = 33;
          break;
        }
        case "invalid-seek": {
          enum8 = 34;
          break;
        }
        case "text-file-busy": {
          enum8 = 35;
          break;
        }
        case "cross-device": {
          enum8 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val8}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg6 + 4, enum8, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline20(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.metadataHash() };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var { lower: v3_0, upper: v3_1 } = e4;
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(v3_0), true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v3_1), true);
      break;
    }
    case "err": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e4;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline21(arg0, arg1, arg2, arg3, arg4) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.metadataHashAt(flags3, result4) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant7 = ret;
  switch (variant7.tag) {
    case "ok": {
      const e4 = variant7.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      var { lower: v5_0, upper: v5_1 } = e4;
      dataView(memory0).setBigInt64(arg4 + 8, toUint64(v5_0), true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v5_1), true);
      break;
    }
    case "err": {
      const e4 = variant7.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
      var val6 = e4;
      let enum6;
      switch (val6) {
        case "access": {
          enum6 = 0;
          break;
        }
        case "would-block": {
          enum6 = 1;
          break;
        }
        case "already": {
          enum6 = 2;
          break;
        }
        case "bad-descriptor": {
          enum6 = 3;
          break;
        }
        case "busy": {
          enum6 = 4;
          break;
        }
        case "deadlock": {
          enum6 = 5;
          break;
        }
        case "quota": {
          enum6 = 6;
          break;
        }
        case "exist": {
          enum6 = 7;
          break;
        }
        case "file-too-large": {
          enum6 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum6 = 9;
          break;
        }
        case "in-progress": {
          enum6 = 10;
          break;
        }
        case "interrupted": {
          enum6 = 11;
          break;
        }
        case "invalid": {
          enum6 = 12;
          break;
        }
        case "io": {
          enum6 = 13;
          break;
        }
        case "is-directory": {
          enum6 = 14;
          break;
        }
        case "loop": {
          enum6 = 15;
          break;
        }
        case "too-many-links": {
          enum6 = 16;
          break;
        }
        case "message-size": {
          enum6 = 17;
          break;
        }
        case "name-too-long": {
          enum6 = 18;
          break;
        }
        case "no-device": {
          enum6 = 19;
          break;
        }
        case "no-entry": {
          enum6 = 20;
          break;
        }
        case "no-lock": {
          enum6 = 21;
          break;
        }
        case "insufficient-memory": {
          enum6 = 22;
          break;
        }
        case "insufficient-space": {
          enum6 = 23;
          break;
        }
        case "not-directory": {
          enum6 = 24;
          break;
        }
        case "not-empty": {
          enum6 = 25;
          break;
        }
        case "not-recoverable": {
          enum6 = 26;
          break;
        }
        case "unsupported": {
          enum6 = 27;
          break;
        }
        case "no-tty": {
          enum6 = 28;
          break;
        }
        case "no-such-device": {
          enum6 = 29;
          break;
        }
        case "overflow": {
          enum6 = 30;
          break;
        }
        case "not-permitted": {
          enum6 = 31;
          break;
        }
        case "pipe": {
          enum6 = 32;
          break;
        }
        case "read-only": {
          enum6 = 33;
          break;
        }
        case "invalid-seek": {
          enum6 = 34;
          break;
        }
        case "text-file-busy": {
          enum6 = 35;
          break;
        }
        case "cross-device": {
          enum6 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val6}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum6, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline22(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(DirectoryEntryStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.readDirectoryEntry() };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant8 = ret;
  switch (variant8.tag) {
    case "ok": {
      const e4 = variant8.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var variant6 = e4;
      if (variant6 === null || variant6 === void 0) {
        dataView(memory0).setInt8(arg1 + 4, 0, true);
      } else {
        const e5 = variant6;
        dataView(memory0).setInt8(arg1 + 4, 1, true);
        var { type: v3_0, name: v3_1 } = e5;
        var val4 = v3_0;
        let enum4;
        switch (val4) {
          case "unknown": {
            enum4 = 0;
            break;
          }
          case "block-device": {
            enum4 = 1;
            break;
          }
          case "character-device": {
            enum4 = 2;
            break;
          }
          case "directory": {
            enum4 = 3;
            break;
          }
          case "fifo": {
            enum4 = 4;
            break;
          }
          case "symbolic-link": {
            enum4 = 5;
            break;
          }
          case "regular-file": {
            enum4 = 6;
            break;
          }
          case "socket": {
            enum4 = 7;
            break;
          }
          default: {
            if (v3_0 instanceof Error) {
              console.error(v3_0);
            }
            throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
          }
        }
        dataView(memory0).setInt8(arg1 + 8, enum4, true);
        var ptr5 = utf8Encode(v3_1, realloc0, memory0);
        var len5 = utf8EncodedLen;
        dataView(memory0).setInt32(arg1 + 16, len5, true);
        dataView(memory0).setInt32(arg1 + 12, ptr5, true);
      }
      break;
    }
    case "err": {
      const e4 = variant8.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val7 = e4;
      let enum7;
      switch (val7) {
        case "access": {
          enum7 = 0;
          break;
        }
        case "would-block": {
          enum7 = 1;
          break;
        }
        case "already": {
          enum7 = 2;
          break;
        }
        case "bad-descriptor": {
          enum7 = 3;
          break;
        }
        case "busy": {
          enum7 = 4;
          break;
        }
        case "deadlock": {
          enum7 = 5;
          break;
        }
        case "quota": {
          enum7 = 6;
          break;
        }
        case "exist": {
          enum7 = 7;
          break;
        }
        case "file-too-large": {
          enum7 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum7 = 9;
          break;
        }
        case "in-progress": {
          enum7 = 10;
          break;
        }
        case "interrupted": {
          enum7 = 11;
          break;
        }
        case "invalid": {
          enum7 = 12;
          break;
        }
        case "io": {
          enum7 = 13;
          break;
        }
        case "is-directory": {
          enum7 = 14;
          break;
        }
        case "loop": {
          enum7 = 15;
          break;
        }
        case "too-many-links": {
          enum7 = 16;
          break;
        }
        case "message-size": {
          enum7 = 17;
          break;
        }
        case "name-too-long": {
          enum7 = 18;
          break;
        }
        case "no-device": {
          enum7 = 19;
          break;
        }
        case "no-entry": {
          enum7 = 20;
          break;
        }
        case "no-lock": {
          enum7 = 21;
          break;
        }
        case "insufficient-memory": {
          enum7 = 22;
          break;
        }
        case "insufficient-space": {
          enum7 = 23;
          break;
        }
        case "not-directory": {
          enum7 = 24;
          break;
        }
        case "not-empty": {
          enum7 = 25;
          break;
        }
        case "not-recoverable": {
          enum7 = 26;
          break;
        }
        case "unsupported": {
          enum7 = 27;
          break;
        }
        case "no-tty": {
          enum7 = 28;
          break;
        }
        case "no-such-device": {
          enum7 = 29;
          break;
        }
        case "overflow": {
          enum7 = 30;
          break;
        }
        case "not-permitted": {
          enum7 = 31;
          break;
        }
        case "pipe": {
          enum7 = 32;
          break;
        }
        case "read-only": {
          enum7 = 33;
          break;
        }
        case "invalid-seek": {
          enum7 = 34;
          break;
        }
        case "text-file-busy": {
          enum7 = 35;
          break;
        }
        case "cross-device": {
          enum7 = 36;
          break;
        }
        default: {
          if (e4 instanceof Error) {
            console.error(e4);
          }
          throw new TypeError(`"${val7}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum7, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
const handleTable0 = [T_FLAG, 0];
const captureTable0 = /* @__PURE__ */ new Map();
let captureCnt0 = 0;
function trampoline23(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable0[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable0.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Error$1.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  const ret = filesystemErrorCode(rsc0);
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant4 = ret;
  if (variant4 === null || variant4 === void 0) {
    dataView(memory0).setInt8(arg1 + 0, 0, true);
  } else {
    const e4 = variant4;
    dataView(memory0).setInt8(arg1 + 0, 1, true);
    var val3 = e4;
    let enum3;
    switch (val3) {
      case "access": {
        enum3 = 0;
        break;
      }
      case "would-block": {
        enum3 = 1;
        break;
      }
      case "already": {
        enum3 = 2;
        break;
      }
      case "bad-descriptor": {
        enum3 = 3;
        break;
      }
      case "busy": {
        enum3 = 4;
        break;
      }
      case "deadlock": {
        enum3 = 5;
        break;
      }
      case "quota": {
        enum3 = 6;
        break;
      }
      case "exist": {
        enum3 = 7;
        break;
      }
      case "file-too-large": {
        enum3 = 8;
        break;
      }
      case "illegal-byte-sequence": {
        enum3 = 9;
        break;
      }
      case "in-progress": {
        enum3 = 10;
        break;
      }
      case "interrupted": {
        enum3 = 11;
        break;
      }
      case "invalid": {
        enum3 = 12;
        break;
      }
      case "io": {
        enum3 = 13;
        break;
      }
      case "is-directory": {
        enum3 = 14;
        break;
      }
      case "loop": {
        enum3 = 15;
        break;
      }
      case "too-many-links": {
        enum3 = 16;
        break;
      }
      case "message-size": {
        enum3 = 17;
        break;
      }
      case "name-too-long": {
        enum3 = 18;
        break;
      }
      case "no-device": {
        enum3 = 19;
        break;
      }
      case "no-entry": {
        enum3 = 20;
        break;
      }
      case "no-lock": {
        enum3 = 21;
        break;
      }
      case "insufficient-memory": {
        enum3 = 22;
        break;
      }
      case "insufficient-space": {
        enum3 = 23;
        break;
      }
      case "not-directory": {
        enum3 = 24;
        break;
      }
      case "not-empty": {
        enum3 = 25;
        break;
      }
      case "not-recoverable": {
        enum3 = 26;
        break;
      }
      case "unsupported": {
        enum3 = 27;
        break;
      }
      case "no-tty": {
        enum3 = 28;
        break;
      }
      case "no-such-device": {
        enum3 = 29;
        break;
      }
      case "overflow": {
        enum3 = 30;
        break;
      }
      case "not-permitted": {
        enum3 = 31;
        break;
      }
      case "pipe": {
        enum3 = 32;
        break;
      }
      case "read-only": {
        enum3 = 33;
        break;
      }
      case "invalid-seek": {
        enum3 = 34;
        break;
      }
      case "text-file-busy": {
        enum3 = 35;
        break;
      }
      case "cross-device": {
        enum3 = 36;
        break;
      }
      default: {
        if (e4 instanceof Error) {
          console.error(e4);
        }
        throw new TypeError(`"${val3}" is not one of the cases of error-code`);
      }
    }
    dataView(memory0).setInt8(arg1 + 1, enum3, true);
  }
}
function trampoline24(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable1[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable1.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(InputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.read(BigInt.asUintN(64, arg1)) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e4 = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      var val3 = e4;
      var len3 = val3.byteLength;
      var ptr3 = realloc0(0, 0, 1, len3 * 1);
      var src3 = new Uint8Array(val3.buffer || val3, val3.byteOffset, len3 * 1);
      new Uint8Array(memory0.buffer, ptr3, len3 * 1).set(src3);
      dataView(memory0).setInt32(arg2 + 8, len3, true);
      dataView(memory0).setInt32(arg2 + 4, ptr3, true);
      break;
    }
    case "err": {
      const e4 = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var variant5 = e4;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e5 = variant5.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e5 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e5[symbolRscHandle];
          if (!handle4) {
            const rep = e5[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep, e5);
            handle4 = rscTableCreateOwn(handleTable0, rep);
          }
          dataView(memory0).setInt32(arg2 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline25(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable1[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable1.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(InputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.blockingRead(BigInt.asUintN(64, arg1)) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e4 = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      var val3 = e4;
      var len3 = val3.byteLength;
      var ptr3 = realloc0(0, 0, 1, len3 * 1);
      var src3 = new Uint8Array(val3.buffer || val3, val3.byteOffset, len3 * 1);
      new Uint8Array(memory0.buffer, ptr3, len3 * 1).set(src3);
      dataView(memory0).setInt32(arg2 + 8, len3, true);
      dataView(memory0).setInt32(arg2 + 4, ptr3, true);
      break;
    }
    case "err": {
      const e4 = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var variant5 = e4;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e5 = variant5.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e5 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e5[symbolRscHandle];
          if (!handle4) {
            const rep = e5[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep, e5);
            handle4 = rscTableCreateOwn(handleTable0, rep);
          }
          dataView(memory0).setInt32(arg2 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline26(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.checkWrite() };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(e4), true);
      break;
    }
    case "err": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var variant4 = e4;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e5 = variant4.val;
          dataView(memory0).setInt8(arg1 + 8, 0, true);
          if (!(e5 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = e5[symbolRscHandle];
          if (!handle3) {
            const rep = e5[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep, e5);
            handle3 = rscTableCreateOwn(handleTable0, rep);
          }
          dataView(memory0).setInt32(arg1 + 12, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg1 + 8, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline27(arg0, arg1, arg2, arg3) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  var ptr3 = arg1;
  var len3 = arg2;
  var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.write(result3) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case "err": {
      const e4 = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      var variant5 = e4;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e5 = variant5.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e5 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e5[symbolRscHandle];
          if (!handle4) {
            const rep = e5[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep, e5);
            handle4 = rscTableCreateOwn(handleTable0, rep);
          }
          dataView(memory0).setInt32(arg3 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline28(arg0, arg1, arg2, arg3) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  var ptr3 = arg1;
  var len3 = arg2;
  var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.blockingWriteAndFlush(result3) };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case "err": {
      const e4 = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      var variant5 = e4;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e5 = variant5.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e5 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e5[symbolRscHandle];
          if (!handle4) {
            const rep = e5[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep, e5);
            handle4 = rscTableCreateOwn(handleTable0, rep);
          }
          dataView(memory0).setInt32(arg3 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline29(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.blockingFlush() };
  } catch (e4) {
    ret = { tag: "err", val: getErrorPayload(e4) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = null;
  }
  curResourceBorrows = [];
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      break;
    }
    case "err": {
      const e4 = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var variant4 = e4;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e5 = variant4.val;
          dataView(memory0).setInt8(arg1 + 4, 0, true);
          if (!(e5 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = e5[symbolRscHandle];
          if (!handle3) {
            const rep = e5[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep, e5);
            handle3 = rscTableCreateOwn(handleTable0, rep);
          }
          dataView(memory0).setInt32(arg1 + 8, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg1 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
}
function trampoline30(arg0, arg1) {
  const ret = getRandomBytes(BigInt.asUintN(64, arg0));
  var val0 = ret;
  var len0 = val0.byteLength;
  var ptr0 = realloc0(0, 0, 1, len0 * 1);
  var src0 = new Uint8Array(val0.buffer || val0, val0.byteOffset, len0 * 1);
  new Uint8Array(memory0.buffer, ptr0, len0 * 1).set(src0);
  dataView(memory0).setInt32(arg1 + 4, len0, true);
  dataView(memory0).setInt32(arg1 + 0, ptr0, true);
}
function trampoline31(arg0) {
  const ret = getEnvironment();
  var vec3 = ret;
  var len3 = vec3.length;
  var result3 = realloc0(0, 0, 4, len3 * 16);
  for (let i2 = 0; i2 < vec3.length; i2++) {
    const e4 = vec3[i2];
    const base = result3 + i2 * 16;
    var [tuple0_0, tuple0_1] = e4;
    var ptr1 = utf8Encode(tuple0_0, realloc0, memory0);
    var len1 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 4, len1, true);
    dataView(memory0).setInt32(base + 0, ptr1, true);
    var ptr2 = utf8Encode(tuple0_1, realloc0, memory0);
    var len2 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 12, len2, true);
    dataView(memory0).setInt32(base + 8, ptr2, true);
  }
  dataView(memory0).setInt32(arg0 + 4, len3, true);
  dataView(memory0).setInt32(arg0 + 0, result3, true);
}
const handleTable3 = [T_FLAG, 0];
const captureTable3 = /* @__PURE__ */ new Map();
let captureCnt3 = 0;
function trampoline32(arg0) {
  const ret = getTerminalStdin();
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e4 = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e4 instanceof TerminalInput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalInput" resource.');
    }
    var handle0 = e4[symbolRscHandle];
    if (!handle0) {
      const rep = e4[symbolRscRep] || ++captureCnt3;
      captureTable3.set(rep, e4);
      handle0 = rscTableCreateOwn(handleTable3, rep);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}
const handleTable4 = [T_FLAG, 0];
const captureTable4 = /* @__PURE__ */ new Map();
let captureCnt4 = 0;
function trampoline33(arg0) {
  const ret = getTerminalStdout();
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e4 = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e4 instanceof TerminalOutput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
    }
    var handle0 = e4[symbolRscHandle];
    if (!handle0) {
      const rep = e4[symbolRscRep] || ++captureCnt4;
      captureTable4.set(rep, e4);
      handle0 = rscTableCreateOwn(handleTable4, rep);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}
function trampoline34(arg0) {
  const ret = getTerminalStderr();
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e4 = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e4 instanceof TerminalOutput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
    }
    var handle0 = e4[symbolRscHandle];
    if (!handle0) {
      const rep = e4[symbolRscRep] || ++captureCnt4;
      captureTable4.set(rep, e4);
      handle0 = rscTableCreateOwn(handleTable4, rep);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}
let realloc1;
let postReturn0;
function trampoline0(handle) {
  const handleEntry = rscTableRemove(handleTable6, handle);
  if (handleEntry.own) {
    const rsc = captureTable6.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose])
        rsc[symbolDispose]();
      captureTable6.delete(handleEntry.rep);
    } else if (DirectoryEntryStream2[symbolCabiDispose]) {
      DirectoryEntryStream2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline1(handle) {
  const handleEntry = rscTableRemove(handleTable0, handle);
  if (handleEntry.own) {
    const rsc = captureTable0.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose])
        rsc[symbolDispose]();
      captureTable0.delete(handleEntry.rep);
    } else if (Error$1[symbolCabiDispose]) {
      Error$1[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline2(handle) {
  const handleEntry = rscTableRemove(handleTable1, handle);
  if (handleEntry.own) {
    const rsc = captureTable1.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose])
        rsc[symbolDispose]();
      captureTable1.delete(handleEntry.rep);
    } else if (InputStream2[symbolCabiDispose]) {
      InputStream2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline3(handle) {
  const handleEntry = rscTableRemove(handleTable2, handle);
  if (handleEntry.own) {
    const rsc = captureTable2.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose])
        rsc[symbolDispose]();
      captureTable2.delete(handleEntry.rep);
    } else if (OutputStream2[symbolCabiDispose]) {
      OutputStream2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline4(handle) {
  const handleEntry = rscTableRemove(handleTable5, handle);
  if (handleEntry.own) {
    const rsc = captureTable5.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose])
        rsc[symbolDispose]();
      captureTable5.delete(handleEntry.rep);
    } else if (Descriptor[symbolCabiDispose]) {
      Descriptor[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline9(handle) {
  const handleEntry = rscTableRemove(handleTable3, handle);
  if (handleEntry.own) {
    const rsc = captureTable3.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose])
        rsc[symbolDispose]();
      captureTable3.delete(handleEntry.rep);
    } else if (TerminalInput2[symbolCabiDispose]) {
      TerminalInput2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline10(handle) {
  const handleEntry = rscTableRemove(handleTable4, handle);
  if (handleEntry.own) {
    const rsc = captureTable4.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose])
        rsc[symbolDispose]();
      captureTable4.delete(handleEntry.rep);
    } else if (TerminalOutput2[symbolCabiDispose]) {
      TerminalOutput2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function generate(arg0, arg1) {
  if (!_initialized)
    throwUninitialized();
  var ptr0 = realloc1(0, 0, 4, 60);
  var val1 = arg0;
  var len1 = val1.byteLength;
  var ptr1 = realloc1(0, 0, 1, len1 * 1);
  var src1 = new Uint8Array(val1.buffer || val1, val1.byteOffset, len1 * 1);
  new Uint8Array(memory0.buffer, ptr1, len1 * 1).set(src1);
  dataView(memory0).setInt32(ptr0 + 4, len1, true);
  dataView(memory0).setInt32(ptr0 + 0, ptr1, true);
  var { name: v2_0, noTypescript: v2_1, instantiation: v2_2, importBindings: v2_3, map: v2_4, compat: v2_5, noNodejsCompat: v2_6, base64Cutoff: v2_7, tlaCompat: v2_8, validLiftingOptimization: v2_9, tracing: v2_10, noNamespacedExports: v2_11, multiMemory: v2_12 } = arg1;
  var ptr3 = utf8Encode(v2_0, realloc1, memory0);
  var len3 = utf8EncodedLen;
  dataView(memory0).setInt32(ptr0 + 12, len3, true);
  dataView(memory0).setInt32(ptr0 + 8, ptr3, true);
  var variant4 = v2_1;
  if (variant4 === null || variant4 === void 0) {
    dataView(memory0).setInt8(ptr0 + 16, 0, true);
  } else {
    const e4 = variant4;
    dataView(memory0).setInt8(ptr0 + 16, 1, true);
    dataView(memory0).setInt8(ptr0 + 17, e4 ? 1 : 0, true);
  }
  var variant6 = v2_2;
  if (variant6 === null || variant6 === void 0) {
    dataView(memory0).setInt8(ptr0 + 18, 0, true);
  } else {
    const e4 = variant6;
    dataView(memory0).setInt8(ptr0 + 18, 1, true);
    var variant5 = e4;
    switch (variant5.tag) {
      case "async": {
        dataView(memory0).setInt8(ptr0 + 19, 0, true);
        break;
      }
      case "sync": {
        dataView(memory0).setInt8(ptr0 + 19, 1, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`InstantiationMode\``);
      }
    }
  }
  var variant8 = v2_3;
  if (variant8 === null || variant8 === void 0) {
    dataView(memory0).setInt8(ptr0 + 20, 0, true);
  } else {
    const e4 = variant8;
    dataView(memory0).setInt8(ptr0 + 20, 1, true);
    var variant7 = e4;
    switch (variant7.tag) {
      case "js": {
        dataView(memory0).setInt8(ptr0 + 21, 0, true);
        break;
      }
      case "hybrid": {
        dataView(memory0).setInt8(ptr0 + 21, 1, true);
        break;
      }
      case "optimized": {
        dataView(memory0).setInt8(ptr0 + 21, 2, true);
        break;
      }
      case "direct-optimized": {
        dataView(memory0).setInt8(ptr0 + 21, 3, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant7.tag)}\` (received \`${variant7}\`) specified for \`BindingsMode\``);
      }
    }
  }
  var variant13 = v2_4;
  if (variant13 === null || variant13 === void 0) {
    dataView(memory0).setInt8(ptr0 + 24, 0, true);
  } else {
    const e4 = variant13;
    dataView(memory0).setInt8(ptr0 + 24, 1, true);
    var vec12 = e4;
    var len12 = vec12.length;
    var result12 = realloc1(0, 0, 4, len12 * 16);
    for (let i2 = 0; i2 < vec12.length; i2++) {
      const e5 = vec12[i2];
      const base = result12 + i2 * 16;
      var [tuple9_0, tuple9_1] = e5;
      var ptr10 = utf8Encode(tuple9_0, realloc1, memory0);
      var len10 = utf8EncodedLen;
      dataView(memory0).setInt32(base + 4, len10, true);
      dataView(memory0).setInt32(base + 0, ptr10, true);
      var ptr11 = utf8Encode(tuple9_1, realloc1, memory0);
      var len11 = utf8EncodedLen;
      dataView(memory0).setInt32(base + 12, len11, true);
      dataView(memory0).setInt32(base + 8, ptr11, true);
    }
    dataView(memory0).setInt32(ptr0 + 32, len12, true);
    dataView(memory0).setInt32(ptr0 + 28, result12, true);
  }
  var variant14 = v2_5;
  if (variant14 === null || variant14 === void 0) {
    dataView(memory0).setInt8(ptr0 + 36, 0, true);
  } else {
    const e4 = variant14;
    dataView(memory0).setInt8(ptr0 + 36, 1, true);
    dataView(memory0).setInt8(ptr0 + 37, e4 ? 1 : 0, true);
  }
  var variant15 = v2_6;
  if (variant15 === null || variant15 === void 0) {
    dataView(memory0).setInt8(ptr0 + 38, 0, true);
  } else {
    const e4 = variant15;
    dataView(memory0).setInt8(ptr0 + 38, 1, true);
    dataView(memory0).setInt8(ptr0 + 39, e4 ? 1 : 0, true);
  }
  var variant16 = v2_7;
  if (variant16 === null || variant16 === void 0) {
    dataView(memory0).setInt8(ptr0 + 40, 0, true);
  } else {
    const e4 = variant16;
    dataView(memory0).setInt8(ptr0 + 40, 1, true);
    dataView(memory0).setInt32(ptr0 + 44, toUint32(e4), true);
  }
  var variant17 = v2_8;
  if (variant17 === null || variant17 === void 0) {
    dataView(memory0).setInt8(ptr0 + 48, 0, true);
  } else {
    const e4 = variant17;
    dataView(memory0).setInt8(ptr0 + 48, 1, true);
    dataView(memory0).setInt8(ptr0 + 49, e4 ? 1 : 0, true);
  }
  var variant18 = v2_9;
  if (variant18 === null || variant18 === void 0) {
    dataView(memory0).setInt8(ptr0 + 50, 0, true);
  } else {
    const e4 = variant18;
    dataView(memory0).setInt8(ptr0 + 50, 1, true);
    dataView(memory0).setInt8(ptr0 + 51, e4 ? 1 : 0, true);
  }
  var variant19 = v2_10;
  if (variant19 === null || variant19 === void 0) {
    dataView(memory0).setInt8(ptr0 + 52, 0, true);
  } else {
    const e4 = variant19;
    dataView(memory0).setInt8(ptr0 + 52, 1, true);
    dataView(memory0).setInt8(ptr0 + 53, e4 ? 1 : 0, true);
  }
  var variant20 = v2_11;
  if (variant20 === null || variant20 === void 0) {
    dataView(memory0).setInt8(ptr0 + 54, 0, true);
  } else {
    const e4 = variant20;
    dataView(memory0).setInt8(ptr0 + 54, 1, true);
    dataView(memory0).setInt8(ptr0 + 55, e4 ? 1 : 0, true);
  }
  var variant21 = v2_12;
  if (variant21 === null || variant21 === void 0) {
    dataView(memory0).setInt8(ptr0 + 56, 0, true);
  } else {
    const e4 = variant21;
    dataView(memory0).setInt8(ptr0 + 56, 1, true);
    dataView(memory0).setInt8(ptr0 + 57, e4 ? 1 : 0, true);
  }
  const ret = exports1.generate(ptr0);
  let variant31;
  switch (dataView(memory0).getUint8(ret + 0, true)) {
    case 0: {
      var len24 = dataView(memory0).getInt32(ret + 8, true);
      var base24 = dataView(memory0).getInt32(ret + 4, true);
      var result24 = [];
      for (let i2 = 0; i2 < len24; i2++) {
        const base = base24 + i2 * 16;
        var ptr22 = dataView(memory0).getInt32(base + 0, true);
        var len22 = dataView(memory0).getInt32(base + 4, true);
        var result22 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr22, len22));
        var ptr23 = dataView(memory0).getInt32(base + 8, true);
        var len23 = dataView(memory0).getInt32(base + 12, true);
        var result23 = new Uint8Array(memory0.buffer.slice(ptr23, ptr23 + len23 * 1));
        result24.push([result22, result23]);
      }
      var len26 = dataView(memory0).getInt32(ret + 16, true);
      var base26 = dataView(memory0).getInt32(ret + 12, true);
      var result26 = [];
      for (let i2 = 0; i2 < len26; i2++) {
        const base = base26 + i2 * 8;
        var ptr25 = dataView(memory0).getInt32(base + 0, true);
        var len25 = dataView(memory0).getInt32(base + 4, true);
        var result25 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr25, len25));
        result26.push(result25);
      }
      var len29 = dataView(memory0).getInt32(ret + 24, true);
      var base29 = dataView(memory0).getInt32(ret + 20, true);
      var result29 = [];
      for (let i2 = 0; i2 < len29; i2++) {
        const base = base29 + i2 * 12;
        var ptr27 = dataView(memory0).getInt32(base + 0, true);
        var len27 = dataView(memory0).getInt32(base + 4, true);
        var result27 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr27, len27));
        let enum28;
        switch (dataView(memory0).getUint8(base + 8, true)) {
          case 0: {
            enum28 = "function";
            break;
          }
          case 1: {
            enum28 = "instance";
            break;
          }
          default: {
            throw new TypeError("invalid discriminant specified for ExportType");
          }
        }
        result29.push([result27, enum28]);
      }
      variant31 = {
        tag: "ok",
        val: {
          files: result24,
          imports: result26,
          exports: result29
        }
      };
      break;
    }
    case 1: {
      var ptr30 = dataView(memory0).getInt32(ret + 4, true);
      var len30 = dataView(memory0).getInt32(ret + 8, true);
      var result30 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr30, len30));
      variant31 = {
        tag: "err",
        val: result30
      };
      break;
    }
    default: {
      throw new TypeError("invalid variant discriminant for expected");
    }
  }
  postReturn0(ret);
  if (variant31.tag === "err") {
    throw new ComponentError(variant31.val);
  }
  return variant31.val;
}
let _initialized = false;
const $init = (async () => {
  const module0 = fetchCompile(new URL("http://localhost:4175/0.0.2/assets/js-component-bindgen-component.core-DyO5Xpr-.wasm", import.meta.url));
  const module1 = fetchCompile(new URL("http://localhost:4175/0.0.2/assets/js-component-bindgen-component.core2-acliwOvP.wasm", import.meta.url));
  const module2 = base64Compile("AGFzbQEAAAABZw5gAn9/AGABfwBgAn9/AX9gA39+fwBgBX9/f39/AGAEf39/fwBgBH9/f38Bf2AHf39/f39/fwBgAn5/AGAJf39/f39+fn9/AX9gBX9/f35/AX9gBX9/f39/AX9gAX8Bf2ADf39/AX8DJiUBAwMAAAAABAcABAAAAwMABQUACAEBAQEGCQoLAgIGAgIMAg0BBAUBcAElJQe7ASYBMAAAATEAAQEyAAIBMwADATQABAE1AAUBNgAGATcABwE4AAgBOQAJAjEwAAoCMTEACwIxMgAMAjEzAA0CMTQADgIxNQAPAjE2ABACMTcAEQIxOAASAjE5ABMCMjAAFAIyMQAVAjIyABYCMjMAFwIyNAAYAjI1ABkCMjYAGgIyNwAbAjI4ABwCMjkAHQIzMAAeAjMxAB8CMzIAIAIzMwAhAjM0ACICMzUAIwIzNgAkCCRpbXBvcnRzAQAK+QMlCQAgAEEAEQEACw0AIAAgASACQQERAwALDQAgACABIAJBAhEDAAsLACAAIAFBAxEAAAsLACAAIAFBBBEAAAsLACAAIAFBBREAAAsLACAAIAFBBhEAAAsRACAAIAEgAiADIARBBxEEAAsVACAAIAEgAiADIAQgBSAGQQgRBwALCwAgACABQQkRAAALEQAgACABIAIgAyAEQQoRBAALCwAgACABQQsRAAALCwAgACABQQwRAAALDQAgACABIAJBDREDAAsNACAAIAEgAkEOEQMACwsAIAAgAUEPEQAACw8AIAAgASACIANBEBEFAAsPACAAIAEgAiADQRERBQALCwAgACABQRIRAAALCwAgACABQRMRCAALCQAgAEEUEQEACwkAIABBFREBAAsJACAAQRYRAQALCQAgAEEXEQEACw8AIAAgASACIANBGBEGAAsZACAAIAEgAiADIAQgBSAGIAcgCEEZEQkACxEAIAAgASACIAMgBEEaEQoACxEAIAAgASACIAMgBEEbEQsACwsAIAAgAUEcEQIACwsAIAAgAUEdEQIACw8AIAAgASACIANBHhEGAAsLACAAIAFBHxECAAsLACAAIAFBIBECAAsJACAAQSERDAALCwAgACABQSIRAgALDQAgACABIAJBIxENAAsJACAAQSQRAQALAC8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBDXdpdC1jb21wb25lbnQHMC4yMDIuMA");
  const module3 = base64Compile("AGFzbQEAAAABaw9gAX8AYAN/fn8AYAJ/fwBgBX9/f39/AGAHf39/f39/fwBgBH9/f38AYAJ+fwBgBH9/f38Bf2AJf39/f39+fn9/AX9gBX9/f35/AX9gBX9/f39/AX9gAn9/AX9gAX8Bf2ADf39/AX9gAX8AAuQBJgABMAAAAAExAAEAATIAAQABMwACAAE0AAIAATUAAgABNgACAAE3AAMAATgABAABOQACAAIxMAADAAIxMQACAAIxMgACAAIxMwABAAIxNAABAAIxNQACAAIxNgAFAAIxNwAFAAIxOAACAAIxOQAGAAIyMAAAAAIyMQAAAAIyMgAAAAIyMwAAAAIyNAAHAAIyNQAIAAIyNgAJAAIyNwAKAAIyOAALAAIyOQALAAIzMAAHAAIzMQALAAIzMgALAAIzMwAMAAIzNAALAAIzNQANAAIzNgAOAAgkaW1wb3J0cwFwASUlCSsBAEEACyUAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkAC8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBDXdpdC1jb21wb25lbnQHMC4yMDIuMAAcBG5hbWUAFRR3aXQtY29tcG9uZW50OmZpeHVwcw");
  ({ exports: exports0 } = await instantiateCore(await module2));
  ({ exports: exports1 } = await instantiateCore(await module0, {
    wasi_snapshot_preview1: {
      environ_get: exports0["31"],
      environ_sizes_get: exports0["32"],
      fd_close: exports0["33"],
      fd_filestat_get: exports0["29"],
      fd_prestat_dir_name: exports0["35"],
      fd_prestat_get: exports0["34"],
      fd_read: exports0["30"],
      fd_readdir: exports0["26"],
      fd_write: exports0["24"],
      path_filestat_get: exports0["27"],
      path_open: exports0["25"],
      proc_exit: exports0["36"],
      random_get: exports0["28"]
    }
  }));
  ({ exports: exports2 } = await instantiateCore(await module1, {
    __main_module__: {
      cabi_realloc: exports1.cabi_realloc
    },
    env: {
      memory: exports1.memory
    },
    "wasi:cli/environment@0.2.0": {
      "get-environment": exports0["20"]
    },
    "wasi:cli/exit@0.2.0": {
      exit: trampoline6
    },
    "wasi:cli/stderr@0.2.0": {
      "get-stderr": trampoline5
    },
    "wasi:cli/stdin@0.2.0": {
      "get-stdin": trampoline7
    },
    "wasi:cli/stdout@0.2.0": {
      "get-stdout": trampoline8
    },
    "wasi:cli/terminal-input@0.2.0": {
      "[resource-drop]terminal-input": trampoline9
    },
    "wasi:cli/terminal-output@0.2.0": {
      "[resource-drop]terminal-output": trampoline10
    },
    "wasi:cli/terminal-stderr@0.2.0": {
      "get-terminal-stderr": exports0["23"]
    },
    "wasi:cli/terminal-stdin@0.2.0": {
      "get-terminal-stdin": exports0["21"]
    },
    "wasi:cli/terminal-stdout@0.2.0": {
      "get-terminal-stdout": exports0["22"]
    },
    "wasi:filesystem/preopens@0.2.0": {
      "get-directories": exports0["0"]
    },
    "wasi:filesystem/types@0.2.0": {
      "[method]descriptor.append-via-stream": exports0["3"],
      "[method]descriptor.get-type": exports0["4"],
      "[method]descriptor.metadata-hash": exports0["9"],
      "[method]descriptor.metadata-hash-at": exports0["10"],
      "[method]descriptor.open-at": exports0["8"],
      "[method]descriptor.read-directory": exports0["5"],
      "[method]descriptor.read-via-stream": exports0["1"],
      "[method]descriptor.stat": exports0["6"],
      "[method]descriptor.stat-at": exports0["7"],
      "[method]descriptor.write-via-stream": exports0["2"],
      "[method]directory-entry-stream.read-directory-entry": exports0["11"],
      "[resource-drop]descriptor": trampoline4,
      "[resource-drop]directory-entry-stream": trampoline0,
      "filesystem-error-code": exports0["12"]
    },
    "wasi:io/error@0.2.0": {
      "[resource-drop]error": trampoline1
    },
    "wasi:io/streams@0.2.0": {
      "[method]input-stream.blocking-read": exports0["14"],
      "[method]input-stream.read": exports0["13"],
      "[method]output-stream.blocking-flush": exports0["18"],
      "[method]output-stream.blocking-write-and-flush": exports0["17"],
      "[method]output-stream.check-write": exports0["15"],
      "[method]output-stream.write": exports0["16"],
      "[resource-drop]input-stream": trampoline2,
      "[resource-drop]output-stream": trampoline3
    },
    "wasi:random/random@0.2.0": {
      "get-random-bytes": exports0["19"]
    }
  }));
  memory0 = exports1.memory;
  realloc0 = exports2.cabi_import_realloc;
  await instantiateCore(await module3, {
    "": {
      $imports: exports0.$imports,
      "0": trampoline11,
      "1": trampoline12,
      "10": trampoline21,
      "11": trampoline22,
      "12": trampoline23,
      "13": trampoline24,
      "14": trampoline25,
      "15": trampoline26,
      "16": trampoline27,
      "17": trampoline28,
      "18": trampoline29,
      "19": trampoline30,
      "2": trampoline13,
      "20": trampoline31,
      "21": trampoline32,
      "22": trampoline33,
      "23": trampoline34,
      "24": exports2.fd_write,
      "25": exports2.path_open,
      "26": exports2.fd_readdir,
      "27": exports2.path_filestat_get,
      "28": exports2.random_get,
      "29": exports2.fd_filestat_get,
      "3": trampoline14,
      "30": exports2.fd_read,
      "31": exports2.environ_get,
      "32": exports2.environ_sizes_get,
      "33": exports2.fd_close,
      "34": exports2.fd_prestat_get,
      "35": exports2.fd_prestat_dir_name,
      "36": exports2.proc_exit,
      "4": trampoline15,
      "5": trampoline16,
      "6": trampoline17,
      "7": trampoline18,
      "8": trampoline19,
      "9": trampoline20
    }
  });
  realloc1 = exports1.cabi_realloc;
  postReturn0 = exports1.cabi_post_generate;
  exports1["cabi_post_generate-types"];
  _initialized = true;
})();
async function transpile() {
  await $init;
  return generate.apply(this, arguments);
}
/*
  @license
	Rollup.js v4.18.0
	Wed, 22 May 2024 05:03:09 GMT - commit bb6f069ea3623b0297ef3895f2dcb98a2ca5ef58

	https://github.com/rollup/rollup

	Released under the MIT License.
*/
var e = "4.18.0", t = { exports: {} };
!function(e4) {
  const t2 = ",".charCodeAt(0), n2 = ";".charCodeAt(0), s2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", i2 = new Uint8Array(64), r2 = new Uint8Array(128);
  for (let e5 = 0; e5 < s2.length; e5++) {
    const t3 = s2.charCodeAt(e5);
    i2[e5] = t3, r2[t3] = e5;
  }
  const o2 = "undefined" != typeof TextDecoder ? new TextDecoder() : "undefined" != typeof Buffer ? { decode: (e5) => Buffer.from(e5.buffer, e5.byteOffset, e5.byteLength).toString() } : { decode(e5) {
    let t3 = "";
    for (let n3 = 0; n3 < e5.length; n3++)
      t3 += String.fromCharCode(e5[n3]);
    return t3;
  } };
  function a2(e5) {
    const t3 = new Int32Array(5), n3 = [];
    let s3 = 0;
    do {
      const i3 = l2(e5, s3), r3 = [];
      let o3 = true, a3 = 0;
      t3[0] = 0;
      for (let n4 = s3; n4 < i3; n4++) {
        let s4;
        n4 = c2(e5, n4, t3, 0);
        const l3 = t3[0];
        l3 < a3 && (o3 = false), a3 = l3, u2(e5, n4, i3) ? (n4 = c2(e5, n4, t3, 1), n4 = c2(e5, n4, t3, 2), n4 = c2(e5, n4, t3, 3), u2(e5, n4, i3) ? (n4 = c2(e5, n4, t3, 4), s4 = [l3, t3[1], t3[2], t3[3], t3[4]]) : s4 = [l3, t3[1], t3[2], t3[3]]) : s4 = [l3], r3.push(s4);
      }
      o3 || d2(r3), n3.push(r3), s3 = i3 + 1;
    } while (s3 <= e5.length);
    return n3;
  }
  function l2(e5, t3) {
    const n3 = e5.indexOf(";", t3);
    return -1 === n3 ? e5.length : n3;
  }
  function c2(e5, t3, n3, s3) {
    let i3 = 0, o3 = 0, a3 = 0;
    do {
      const n4 = e5.charCodeAt(t3++);
      a3 = r2[n4], i3 |= (31 & a3) << o3, o3 += 5;
    } while (32 & a3);
    const l3 = 1 & i3;
    return i3 >>>= 1, l3 && (i3 = -2147483648 | -i3), n3[s3] += i3, t3;
  }
  function u2(e5, n3, s3) {
    return !(n3 >= s3) && e5.charCodeAt(n3) !== t2;
  }
  function d2(e5) {
    e5.sort(h2);
  }
  function h2(e5, t3) {
    return e5[0] - t3[0];
  }
  function p2(e5) {
    const s3 = new Int32Array(5), i3 = 16384, r3 = i3 - 36, a3 = new Uint8Array(i3), l3 = a3.subarray(0, r3);
    let c3 = 0, u3 = "";
    for (let d3 = 0; d3 < e5.length; d3++) {
      const h3 = e5[d3];
      if (d3 > 0 && (c3 === i3 && (u3 += o2.decode(a3), c3 = 0), a3[c3++] = n2), 0 !== h3.length) {
        s3[0] = 0;
        for (let e6 = 0; e6 < h3.length; e6++) {
          const n3 = h3[e6];
          c3 > r3 && (u3 += o2.decode(l3), a3.copyWithin(0, r3, c3), c3 -= r3), e6 > 0 && (a3[c3++] = t2), c3 = f2(a3, c3, s3, n3, 0), 1 !== n3.length && (c3 = f2(a3, c3, s3, n3, 1), c3 = f2(a3, c3, s3, n3, 2), c3 = f2(a3, c3, s3, n3, 3), 4 !== n3.length && (c3 = f2(a3, c3, s3, n3, 4)));
        }
      }
    }
    return u3 + o2.decode(a3.subarray(0, c3));
  }
  function f2(e5, t3, n3, s3, r3) {
    const o3 = s3[r3];
    let a3 = o3 - n3[r3];
    n3[r3] = o3, a3 = a3 < 0 ? -a3 << 1 | 1 : a3 << 1;
    do {
      let n4 = 31 & a3;
      a3 >>>= 5, a3 > 0 && (n4 |= 32), e5[t3++] = i2[n4];
    } while (a3 > 0);
    return t3;
  }
  e4.decode = a2, e4.encode = p2, Object.defineProperty(e4, "__esModule", { value: true });
}(t.exports);
var n = t.exports;
class s {
  constructor(e4) {
    this.bits = e4 instanceof s ? e4.bits.slice() : [];
  }
  add(e4) {
    this.bits[e4 >> 5] |= 1 << (31 & e4);
  }
  has(e4) {
    return !!(this.bits[e4 >> 5] & 1 << (31 & e4));
  }
}
let i = class e2 {
  constructor(e4, t2, n2) {
    this.start = e4, this.end = t2, this.original = n2, this.intro = "", this.outro = "", this.content = n2, this.storeName = false, this.edited = false, this.previous = null, this.next = null;
  }
  appendLeft(e4) {
    this.outro += e4;
  }
  appendRight(e4) {
    this.intro = this.intro + e4;
  }
  clone() {
    const t2 = new e2(this.start, this.end, this.original);
    return t2.intro = this.intro, t2.outro = this.outro, t2.content = this.content, t2.storeName = this.storeName, t2.edited = this.edited, t2;
  }
  contains(e4) {
    return this.start < e4 && e4 < this.end;
  }
  eachNext(e4) {
    let t2 = this;
    for (; t2; )
      e4(t2), t2 = t2.next;
  }
  eachPrevious(e4) {
    let t2 = this;
    for (; t2; )
      e4(t2), t2 = t2.previous;
  }
  edit(e4, t2, n2) {
    return this.content = e4, n2 || (this.intro = "", this.outro = ""), this.storeName = t2, this.edited = true, this;
  }
  prependLeft(e4) {
    this.outro = e4 + this.outro;
  }
  prependRight(e4) {
    this.intro = e4 + this.intro;
  }
  reset() {
    this.intro = "", this.outro = "", this.edited && (this.content = this.original, this.storeName = false, this.edited = false);
  }
  split(t2) {
    const n2 = t2 - this.start, s2 = this.original.slice(0, n2), i2 = this.original.slice(n2);
    this.original = s2;
    const r2 = new e2(t2, this.end, i2);
    return r2.outro = this.outro, this.outro = "", this.end = t2, this.edited ? (r2.edit("", false), this.content = "") : this.content = s2, r2.next = this.next, r2.next && (r2.next.previous = r2), r2.previous = this, this.next = r2, r2;
  }
  toString() {
    return this.intro + this.content + this.outro;
  }
  trimEnd(e4) {
    if (this.outro = this.outro.replace(e4, ""), this.outro.length)
      return true;
    const t2 = this.content.replace(e4, "");
    return t2.length ? (t2 !== this.content && (this.split(this.start + t2.length).edit("", void 0, true), this.edited && this.edit(t2, this.storeName, true)), true) : (this.edit("", void 0, true), this.intro = this.intro.replace(e4, ""), !!this.intro.length || void 0);
  }
  trimStart(e4) {
    if (this.intro = this.intro.replace(e4, ""), this.intro.length)
      return true;
    const t2 = this.content.replace(e4, "");
    if (t2.length) {
      if (t2 !== this.content) {
        const e5 = this.split(this.end - t2.length);
        this.edited && e5.edit(t2, this.storeName, true), this.edit("", void 0, true);
      }
      return true;
    }
    return this.edit("", void 0, true), this.outro = this.outro.replace(e4, ""), !!this.outro.length || void 0;
  }
};
function r() {
  return "undefined" != typeof globalThis && "function" == typeof globalThis.btoa ? (e4) => globalThis.btoa(unescape(encodeURIComponent(e4))) : "function" == typeof Buffer ? (e4) => Buffer.from(e4, "utf-8").toString("base64") : () => {
    throw new Error("Unsupported environment: `window.btoa` or `Buffer` should be supported.");
  };
}
const o = r();
class a {
  constructor(e4) {
    this.version = 3, this.file = e4.file, this.sources = e4.sources, this.sourcesContent = e4.sourcesContent, this.names = e4.names, this.mappings = n.encode(e4.mappings), void 0 !== e4.x_google_ignoreList && (this.x_google_ignoreList = e4.x_google_ignoreList);
  }
  toString() {
    return JSON.stringify(this);
  }
  toUrl() {
    return "data:application/json;charset=utf-8;base64," + o(this.toString());
  }
}
function l(e4, t2) {
  const n2 = e4.split(/[/\\]/), s2 = t2.split(/[/\\]/);
  for (n2.pop(); n2[0] === s2[0]; )
    n2.shift(), s2.shift();
  if (n2.length) {
    let e5 = n2.length;
    for (; e5--; )
      n2[e5] = "..";
  }
  return n2.concat(s2).join("/");
}
const c = Object.prototype.toString;
function u(e4) {
  return "[object Object]" === c.call(e4);
}
function d(e4) {
  const t2 = e4.split("\n"), n2 = [];
  for (let e5 = 0, s2 = 0; e5 < t2.length; e5++)
    n2.push(s2), s2 += t2[e5].length + 1;
  return function(e5) {
    let t3 = 0, s2 = n2.length;
    for (; t3 < s2; ) {
      const i3 = t3 + s2 >> 1;
      e5 < n2[i3] ? s2 = i3 : t3 = i3 + 1;
    }
    const i2 = t3 - 1;
    return { line: i2, column: e5 - n2[i2] };
  };
}
const h = /\w/;
class p {
  constructor(e4) {
    this.hires = e4, this.generatedCodeLine = 0, this.generatedCodeColumn = 0, this.raw = [], this.rawSegments = this.raw[this.generatedCodeLine] = [], this.pending = null;
  }
  addEdit(e4, t2, n2, s2) {
    if (t2.length) {
      const i2 = t2.length - 1;
      let r2 = t2.indexOf("\n", 0), o2 = -1;
      for (; r2 >= 0 && i2 > r2; ) {
        const i3 = [this.generatedCodeColumn, e4, n2.line, n2.column];
        s2 >= 0 && i3.push(s2), this.rawSegments.push(i3), this.generatedCodeLine += 1, this.raw[this.generatedCodeLine] = this.rawSegments = [], this.generatedCodeColumn = 0, o2 = r2, r2 = t2.indexOf("\n", r2 + 1);
      }
      const a2 = [this.generatedCodeColumn, e4, n2.line, n2.column];
      s2 >= 0 && a2.push(s2), this.rawSegments.push(a2), this.advance(t2.slice(o2 + 1));
    } else
      this.pending && (this.rawSegments.push(this.pending), this.advance(t2));
    this.pending = null;
  }
  addUneditedChunk(e4, t2, n2, s2, i2) {
    let r2 = t2.start, o2 = true, a2 = false;
    for (; r2 < t2.end; ) {
      if (this.hires || o2 || i2.has(r2)) {
        const t3 = [this.generatedCodeColumn, e4, s2.line, s2.column];
        "boundary" === this.hires ? h.test(n2[r2]) ? a2 || (this.rawSegments.push(t3), a2 = true) : (this.rawSegments.push(t3), a2 = false) : this.rawSegments.push(t3);
      }
      "\n" === n2[r2] ? (s2.line += 1, s2.column = 0, this.generatedCodeLine += 1, this.raw[this.generatedCodeLine] = this.rawSegments = [], this.generatedCodeColumn = 0, o2 = true) : (s2.column += 1, this.generatedCodeColumn += 1, o2 = false), r2 += 1;
    }
    this.pending = null;
  }
  advance(e4) {
    if (!e4)
      return;
    const t2 = e4.split("\n");
    if (t2.length > 1) {
      for (let e5 = 0; e5 < t2.length - 1; e5++)
        this.generatedCodeLine++, this.raw[this.generatedCodeLine] = this.rawSegments = [];
      this.generatedCodeColumn = 0;
    }
    this.generatedCodeColumn += t2[t2.length - 1].length;
  }
}
const f = "\n", m = { insertLeft: false, insertRight: false, storeName: false };
class g {
  constructor(e4, t2 = {}) {
    const n2 = new i(0, e4.length, e4);
    Object.defineProperties(this, { original: { writable: true, value: e4 }, outro: { writable: true, value: "" }, intro: { writable: true, value: "" }, firstChunk: { writable: true, value: n2 }, lastChunk: { writable: true, value: n2 }, lastSearchedChunk: { writable: true, value: n2 }, byStart: { writable: true, value: {} }, byEnd: { writable: true, value: {} }, filename: { writable: true, value: t2.filename }, indentExclusionRanges: { writable: true, value: t2.indentExclusionRanges }, sourcemapLocations: { writable: true, value: new s() }, storedNames: { writable: true, value: {} }, indentStr: { writable: true, value: void 0 }, ignoreList: { writable: true, value: t2.ignoreList } }), this.byStart[0] = n2, this.byEnd[e4.length] = n2;
  }
  addSourcemapLocation(e4) {
    this.sourcemapLocations.add(e4);
  }
  append(e4) {
    if ("string" != typeof e4)
      throw new TypeError("outro content must be a string");
    return this.outro += e4, this;
  }
  appendLeft(e4, t2) {
    if ("string" != typeof t2)
      throw new TypeError("inserted content must be a string");
    this._split(e4);
    const n2 = this.byEnd[e4];
    return n2 ? n2.appendLeft(t2) : this.intro += t2, this;
  }
  appendRight(e4, t2) {
    if ("string" != typeof t2)
      throw new TypeError("inserted content must be a string");
    this._split(e4);
    const n2 = this.byStart[e4];
    return n2 ? n2.appendRight(t2) : this.outro += t2, this;
  }
  clone() {
    const e4 = new g(this.original, { filename: this.filename });
    let t2 = this.firstChunk, n2 = e4.firstChunk = e4.lastSearchedChunk = t2.clone();
    for (; t2; ) {
      e4.byStart[n2.start] = n2, e4.byEnd[n2.end] = n2;
      const s2 = t2.next, i2 = s2 && s2.clone();
      i2 && (n2.next = i2, i2.previous = n2, n2 = i2), t2 = s2;
    }
    return e4.lastChunk = n2, this.indentExclusionRanges && (e4.indentExclusionRanges = this.indentExclusionRanges.slice()), e4.sourcemapLocations = new s(this.sourcemapLocations), e4.intro = this.intro, e4.outro = this.outro, e4;
  }
  generateDecodedMap(e4) {
    e4 = e4 || {};
    const t2 = Object.keys(this.storedNames), n2 = new p(e4.hires), s2 = d(this.original);
    return this.intro && n2.advance(this.intro), this.firstChunk.eachNext((e5) => {
      const i2 = s2(e5.start);
      e5.intro.length && n2.advance(e5.intro), e5.edited ? n2.addEdit(0, e5.content, i2, e5.storeName ? t2.indexOf(e5.original) : -1) : n2.addUneditedChunk(0, e5, this.original, i2, this.sourcemapLocations), e5.outro.length && n2.advance(e5.outro);
    }), { file: e4.file ? e4.file.split(/[/\\]/).pop() : void 0, sources: [e4.source ? l(e4.file || "", e4.source) : e4.file || ""], sourcesContent: e4.includeContent ? [this.original] : void 0, names: t2, mappings: n2.raw, x_google_ignoreList: this.ignoreList ? [0] : void 0 };
  }
  generateMap(e4) {
    return new a(this.generateDecodedMap(e4));
  }
  _ensureindentStr() {
    void 0 === this.indentStr && (this.indentStr = function(e4) {
      const t2 = e4.split("\n"), n2 = t2.filter((e5) => /^\t+/.test(e5)), s2 = t2.filter((e5) => /^ {2,}/.test(e5));
      if (0 === n2.length && 0 === s2.length)
        return null;
      if (n2.length >= s2.length)
        return "	";
      const i2 = s2.reduce((e5, t3) => {
        const n3 = /^ +/.exec(t3)[0].length;
        return Math.min(n3, e5);
      }, 1 / 0);
      return new Array(i2 + 1).join(" ");
    }(this.original));
  }
  _getRawIndentString() {
    return this._ensureindentStr(), this.indentStr;
  }
  getIndentString() {
    return this._ensureindentStr(), null === this.indentStr ? "	" : this.indentStr;
  }
  indent(e4, t2) {
    const n2 = /^[^\r\n]/gm;
    if (u(e4) && (t2 = e4, e4 = void 0), void 0 === e4 && (this._ensureindentStr(), e4 = this.indentStr || "	"), "" === e4)
      return this;
    const s2 = {};
    if ((t2 = t2 || {}).exclude) {
      ("number" == typeof t2.exclude[0] ? [t2.exclude] : t2.exclude).forEach((e5) => {
        for (let t3 = e5[0]; t3 < e5[1]; t3 += 1)
          s2[t3] = true;
      });
    }
    let i2 = false !== t2.indentStart;
    const r2 = (t3) => i2 ? `${e4}${t3}` : (i2 = true, t3);
    this.intro = this.intro.replace(n2, r2);
    let o2 = 0, a2 = this.firstChunk;
    for (; a2; ) {
      const t3 = a2.end;
      if (a2.edited)
        s2[o2] || (a2.content = a2.content.replace(n2, r2), a2.content.length && (i2 = "\n" === a2.content[a2.content.length - 1]));
      else
        for (o2 = a2.start; o2 < t3; ) {
          if (!s2[o2]) {
            const t4 = this.original[o2];
            "\n" === t4 ? i2 = true : "\r" !== t4 && i2 && (i2 = false, o2 === a2.start || (this._splitChunk(a2, o2), a2 = a2.next), a2.prependRight(e4));
          }
          o2 += 1;
        }
      o2 = a2.end, a2 = a2.next;
    }
    return this.outro = this.outro.replace(n2, r2), this;
  }
  insert() {
    throw new Error("magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)");
  }
  insertLeft(e4, t2) {
    return m.insertLeft || (console.warn("magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead"), m.insertLeft = true), this.appendLeft(e4, t2);
  }
  insertRight(e4, t2) {
    return m.insertRight || (console.warn("magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead"), m.insertRight = true), this.prependRight(e4, t2);
  }
  move(e4, t2, n2) {
    if (n2 >= e4 && n2 <= t2)
      throw new Error("Cannot move a selection inside itself");
    this._split(e4), this._split(t2), this._split(n2);
    const s2 = this.byStart[e4], i2 = this.byEnd[t2], r2 = s2.previous, o2 = i2.next, a2 = this.byStart[n2];
    if (!a2 && i2 === this.lastChunk)
      return this;
    const l2 = a2 ? a2.previous : this.lastChunk;
    return r2 && (r2.next = o2), o2 && (o2.previous = r2), l2 && (l2.next = s2), a2 && (a2.previous = i2), s2.previous || (this.firstChunk = i2.next), i2.next || (this.lastChunk = s2.previous, this.lastChunk.next = null), s2.previous = l2, i2.next = a2 || null, l2 || (this.firstChunk = s2), a2 || (this.lastChunk = i2), this;
  }
  overwrite(e4, t2, n2, s2) {
    return s2 = s2 || {}, this.update(e4, t2, n2, { ...s2, overwrite: !s2.contentOnly });
  }
  update(e4, t2, n2, s2) {
    if ("string" != typeof n2)
      throw new TypeError("replacement content must be a string");
    for (; e4 < 0; )
      e4 += this.original.length;
    for (; t2 < 0; )
      t2 += this.original.length;
    if (t2 > this.original.length)
      throw new Error("end is out of bounds");
    if (e4 === t2)
      throw new Error("Cannot overwrite a zero-length range – use appendLeft or prependRight instead");
    this._split(e4), this._split(t2), true === s2 && (m.storeName || (console.warn("The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string"), m.storeName = true), s2 = { storeName: true });
    const r2 = void 0 !== s2 && s2.storeName, o2 = void 0 !== s2 && s2.overwrite;
    if (r2) {
      const n3 = this.original.slice(e4, t2);
      Object.defineProperty(this.storedNames, n3, { writable: true, value: true, enumerable: true });
    }
    const a2 = this.byStart[e4], l2 = this.byEnd[t2];
    if (a2) {
      let e5 = a2;
      for (; e5 !== l2; ) {
        if (e5.next !== this.byStart[e5.end])
          throw new Error("Cannot overwrite across a split point");
        e5 = e5.next, e5.edit("", false);
      }
      a2.edit(n2, r2, !o2);
    } else {
      const s3 = new i(e4, t2, "").edit(n2, r2);
      l2.next = s3, s3.previous = l2;
    }
    return this;
  }
  prepend(e4) {
    if ("string" != typeof e4)
      throw new TypeError("outro content must be a string");
    return this.intro = e4 + this.intro, this;
  }
  prependLeft(e4, t2) {
    if ("string" != typeof t2)
      throw new TypeError("inserted content must be a string");
    this._split(e4);
    const n2 = this.byEnd[e4];
    return n2 ? n2.prependLeft(t2) : this.intro = t2 + this.intro, this;
  }
  prependRight(e4, t2) {
    if ("string" != typeof t2)
      throw new TypeError("inserted content must be a string");
    this._split(e4);
    const n2 = this.byStart[e4];
    return n2 ? n2.prependRight(t2) : this.outro = t2 + this.outro, this;
  }
  remove(e4, t2) {
    for (; e4 < 0; )
      e4 += this.original.length;
    for (; t2 < 0; )
      t2 += this.original.length;
    if (e4 === t2)
      return this;
    if (e4 < 0 || t2 > this.original.length)
      throw new Error("Character is out of bounds");
    if (e4 > t2)
      throw new Error("end must be greater than start");
    this._split(e4), this._split(t2);
    let n2 = this.byStart[e4];
    for (; n2; )
      n2.intro = "", n2.outro = "", n2.edit(""), n2 = t2 > n2.end ? this.byStart[n2.end] : null;
    return this;
  }
  reset(e4, t2) {
    for (; e4 < 0; )
      e4 += this.original.length;
    for (; t2 < 0; )
      t2 += this.original.length;
    if (e4 === t2)
      return this;
    if (e4 < 0 || t2 > this.original.length)
      throw new Error("Character is out of bounds");
    if (e4 > t2)
      throw new Error("end must be greater than start");
    this._split(e4), this._split(t2);
    let n2 = this.byStart[e4];
    for (; n2; )
      n2.reset(), n2 = t2 > n2.end ? this.byStart[n2.end] : null;
    return this;
  }
  lastChar() {
    if (this.outro.length)
      return this.outro[this.outro.length - 1];
    let e4 = this.lastChunk;
    do {
      if (e4.outro.length)
        return e4.outro[e4.outro.length - 1];
      if (e4.content.length)
        return e4.content[e4.content.length - 1];
      if (e4.intro.length)
        return e4.intro[e4.intro.length - 1];
    } while (e4 = e4.previous);
    return this.intro.length ? this.intro[this.intro.length - 1] : "";
  }
  lastLine() {
    let e4 = this.outro.lastIndexOf(f);
    if (-1 !== e4)
      return this.outro.substr(e4 + 1);
    let t2 = this.outro, n2 = this.lastChunk;
    do {
      if (n2.outro.length > 0) {
        if (e4 = n2.outro.lastIndexOf(f), -1 !== e4)
          return n2.outro.substr(e4 + 1) + t2;
        t2 = n2.outro + t2;
      }
      if (n2.content.length > 0) {
        if (e4 = n2.content.lastIndexOf(f), -1 !== e4)
          return n2.content.substr(e4 + 1) + t2;
        t2 = n2.content + t2;
      }
      if (n2.intro.length > 0) {
        if (e4 = n2.intro.lastIndexOf(f), -1 !== e4)
          return n2.intro.substr(e4 + 1) + t2;
        t2 = n2.intro + t2;
      }
    } while (n2 = n2.previous);
    return e4 = this.intro.lastIndexOf(f), -1 !== e4 ? this.intro.substr(e4 + 1) + t2 : this.intro + t2;
  }
  slice(e4 = 0, t2 = this.original.length) {
    for (; e4 < 0; )
      e4 += this.original.length;
    for (; t2 < 0; )
      t2 += this.original.length;
    let n2 = "", s2 = this.firstChunk;
    for (; s2 && (s2.start > e4 || s2.end <= e4); ) {
      if (s2.start < t2 && s2.end >= t2)
        return n2;
      s2 = s2.next;
    }
    if (s2 && s2.edited && s2.start !== e4)
      throw new Error(`Cannot use replaced character ${e4} as slice start anchor.`);
    const i2 = s2;
    for (; s2; ) {
      !s2.intro || i2 === s2 && s2.start !== e4 || (n2 += s2.intro);
      const r2 = s2.start < t2 && s2.end >= t2;
      if (r2 && s2.edited && s2.end !== t2)
        throw new Error(`Cannot use replaced character ${t2} as slice end anchor.`);
      const o2 = i2 === s2 ? e4 - s2.start : 0, a2 = r2 ? s2.content.length + t2 - s2.end : s2.content.length;
      if (n2 += s2.content.slice(o2, a2), !s2.outro || r2 && s2.end !== t2 || (n2 += s2.outro), r2)
        break;
      s2 = s2.next;
    }
    return n2;
  }
  snip(e4, t2) {
    const n2 = this.clone();
    return n2.remove(0, e4), n2.remove(t2, n2.original.length), n2;
  }
  _split(e4) {
    if (this.byStart[e4] || this.byEnd[e4])
      return;
    let t2 = this.lastSearchedChunk;
    const n2 = e4 > t2.end;
    for (; t2; ) {
      if (t2.contains(e4))
        return this._splitChunk(t2, e4);
      t2 = n2 ? this.byStart[t2.end] : this.byEnd[t2.start];
    }
  }
  _splitChunk(e4, t2) {
    if (e4.edited && e4.content.length) {
      const n3 = d(this.original)(t2);
      throw new Error(`Cannot split a chunk that has already been edited (${n3.line}:${n3.column} – "${e4.original}")`);
    }
    const n2 = e4.split(t2);
    return this.byEnd[t2] = e4, this.byStart[t2] = n2, this.byEnd[n2.end] = n2, e4 === this.lastChunk && (this.lastChunk = n2), this.lastSearchedChunk = e4, true;
  }
  toString() {
    let e4 = this.intro, t2 = this.firstChunk;
    for (; t2; )
      e4 += t2.toString(), t2 = t2.next;
    return e4 + this.outro;
  }
  isEmpty() {
    let e4 = this.firstChunk;
    do {
      if (e4.intro.length && e4.intro.trim() || e4.content.length && e4.content.trim() || e4.outro.length && e4.outro.trim())
        return false;
    } while (e4 = e4.next);
    return true;
  }
  length() {
    let e4 = this.firstChunk, t2 = 0;
    do {
      t2 += e4.intro.length + e4.content.length + e4.outro.length;
    } while (e4 = e4.next);
    return t2;
  }
  trimLines() {
    return this.trim("[\\r\\n]");
  }
  trim(e4) {
    return this.trimStart(e4).trimEnd(e4);
  }
  trimEndAborted(e4) {
    const t2 = new RegExp((e4 || "\\s") + "+$");
    if (this.outro = this.outro.replace(t2, ""), this.outro.length)
      return true;
    let n2 = this.lastChunk;
    do {
      const e5 = n2.end, s2 = n2.trimEnd(t2);
      if (n2.end !== e5 && (this.lastChunk === n2 && (this.lastChunk = n2.next), this.byEnd[n2.end] = n2, this.byStart[n2.next.start] = n2.next, this.byEnd[n2.next.end] = n2.next), s2)
        return true;
      n2 = n2.previous;
    } while (n2);
    return false;
  }
  trimEnd(e4) {
    return this.trimEndAborted(e4), this;
  }
  trimStartAborted(e4) {
    const t2 = new RegExp("^" + (e4 || "\\s") + "+");
    if (this.intro = this.intro.replace(t2, ""), this.intro.length)
      return true;
    let n2 = this.firstChunk;
    do {
      const e5 = n2.end, s2 = n2.trimStart(t2);
      if (n2.end !== e5 && (n2 === this.lastChunk && (this.lastChunk = n2.next), this.byEnd[n2.end] = n2, this.byStart[n2.next.start] = n2.next, this.byEnd[n2.next.end] = n2.next), s2)
        return true;
      n2 = n2.next;
    } while (n2);
    return false;
  }
  trimStart(e4) {
    return this.trimStartAborted(e4), this;
  }
  hasChanged() {
    return this.original !== this.toString();
  }
  _replaceRegexp(e4, t2) {
    function n2(e5, n3) {
      return "string" == typeof t2 ? t2.replace(/\$(\$|&|\d+)/g, (t3, n4) => {
        if ("$" === n4)
          return "$";
        if ("&" === n4)
          return e5[0];
        return +n4 < e5.length ? e5[+n4] : `$${n4}`;
      }) : t2(...e5, e5.index, n3, e5.groups);
    }
    if (e4.global) {
      (function(e5, t3) {
        let n3;
        const s2 = [];
        for (; n3 = e5.exec(t3); )
          s2.push(n3);
        return s2;
      })(e4, this.original).forEach((e5) => {
        if (null != e5.index) {
          const t3 = n2(e5, this.original);
          t3 !== e5[0] && this.overwrite(e5.index, e5.index + e5[0].length, t3);
        }
      });
    } else {
      const t3 = this.original.match(e4);
      if (t3 && null != t3.index) {
        const e5 = n2(t3, this.original);
        e5 !== t3[0] && this.overwrite(t3.index, t3.index + t3[0].length, e5);
      }
    }
    return this;
  }
  _replaceString(e4, t2) {
    const { original: n2 } = this, s2 = n2.indexOf(e4);
    return -1 !== s2 && this.overwrite(s2, s2 + e4.length, t2), this;
  }
  replace(e4, t2) {
    return "string" == typeof e4 ? this._replaceString(e4, t2) : this._replaceRegexp(e4, t2);
  }
  _replaceAllString(e4, t2) {
    const { original: n2 } = this, s2 = e4.length;
    for (let i2 = n2.indexOf(e4); -1 !== i2; i2 = n2.indexOf(e4, i2 + s2)) {
      n2.slice(i2, i2 + s2) !== t2 && this.overwrite(i2, i2 + s2, t2);
    }
    return this;
  }
  replaceAll(e4, t2) {
    if ("string" == typeof e4)
      return this._replaceAllString(e4, t2);
    if (!e4.global)
      throw new TypeError("MagicString.prototype.replaceAll called with a non-global RegExp argument");
    return this._replaceRegexp(e4, t2);
  }
}
const y = Object.prototype.hasOwnProperty;
let b = class e3 {
  constructor(e4 = {}) {
    this.intro = e4.intro || "", this.separator = void 0 !== e4.separator ? e4.separator : "\n", this.sources = [], this.uniqueSources = [], this.uniqueSourceIndexByFilename = {};
  }
  addSource(e4) {
    if (e4 instanceof g)
      return this.addSource({ content: e4, filename: e4.filename, separator: this.separator });
    if (!u(e4) || !e4.content)
      throw new Error("bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`");
    if (["filename", "ignoreList", "indentExclusionRanges", "separator"].forEach((t2) => {
      y.call(e4, t2) || (e4[t2] = e4.content[t2]);
    }), void 0 === e4.separator && (e4.separator = this.separator), e4.filename)
      if (y.call(this.uniqueSourceIndexByFilename, e4.filename)) {
        const t2 = this.uniqueSources[this.uniqueSourceIndexByFilename[e4.filename]];
        if (e4.content.original !== t2.content)
          throw new Error(`Illegal source: same filename (${e4.filename}), different contents`);
      } else
        this.uniqueSourceIndexByFilename[e4.filename] = this.uniqueSources.length, this.uniqueSources.push({ filename: e4.filename, content: e4.content.original });
    return this.sources.push(e4), this;
  }
  append(e4, t2) {
    return this.addSource({ content: new g(e4), separator: t2 && t2.separator || "" }), this;
  }
  clone() {
    const t2 = new e3({ intro: this.intro, separator: this.separator });
    return this.sources.forEach((e4) => {
      t2.addSource({ filename: e4.filename, content: e4.content.clone(), separator: e4.separator });
    }), t2;
  }
  generateDecodedMap(e4 = {}) {
    const t2 = [];
    let n2;
    this.sources.forEach((e5) => {
      Object.keys(e5.content.storedNames).forEach((e6) => {
        ~t2.indexOf(e6) || t2.push(e6);
      });
    });
    const s2 = new p(e4.hires);
    return this.intro && s2.advance(this.intro), this.sources.forEach((e5, i2) => {
      i2 > 0 && s2.advance(this.separator);
      const r2 = e5.filename ? this.uniqueSourceIndexByFilename[e5.filename] : -1, o2 = e5.content, a2 = d(o2.original);
      o2.intro && s2.advance(o2.intro), o2.firstChunk.eachNext((n3) => {
        const i3 = a2(n3.start);
        n3.intro.length && s2.advance(n3.intro), e5.filename ? n3.edited ? s2.addEdit(r2, n3.content, i3, n3.storeName ? t2.indexOf(n3.original) : -1) : s2.addUneditedChunk(r2, n3, o2.original, i3, o2.sourcemapLocations) : s2.advance(n3.content), n3.outro.length && s2.advance(n3.outro);
      }), o2.outro && s2.advance(o2.outro), e5.ignoreList && -1 !== r2 && (void 0 === n2 && (n2 = []), n2.push(r2));
    }), { file: e4.file ? e4.file.split(/[/\\]/).pop() : void 0, sources: this.uniqueSources.map((t3) => e4.file ? l(e4.file, t3.filename) : t3.filename), sourcesContent: this.uniqueSources.map((t3) => e4.includeContent ? t3.content : null), names: t2, mappings: s2.raw, x_google_ignoreList: n2 };
  }
  generateMap(e4) {
    return new a(this.generateDecodedMap(e4));
  }
  getIndentString() {
    const e4 = {};
    return this.sources.forEach((t2) => {
      const n2 = t2.content._getRawIndentString();
      null !== n2 && (e4[n2] || (e4[n2] = 0), e4[n2] += 1);
    }), Object.keys(e4).sort((t2, n2) => e4[t2] - e4[n2])[0] || "	";
  }
  indent(e4) {
    if (arguments.length || (e4 = this.getIndentString()), "" === e4)
      return this;
    let t2 = !this.intro || "\n" === this.intro.slice(-1);
    return this.sources.forEach((n2, s2) => {
      const i2 = void 0 !== n2.separator ? n2.separator : this.separator, r2 = t2 || s2 > 0 && /\r?\n$/.test(i2);
      n2.content.indent(e4, { exclude: n2.indentExclusionRanges, indentStart: r2 }), t2 = "\n" === n2.content.lastChar();
    }), this.intro && (this.intro = e4 + this.intro.replace(/^[^\n]/gm, (t3, n2) => n2 > 0 ? e4 + t3 : t3)), this;
  }
  prepend(e4) {
    return this.intro = e4 + this.intro, this;
  }
  toString() {
    const e4 = this.sources.map((e5, t2) => {
      const n2 = void 0 !== e5.separator ? e5.separator : this.separator;
      return (t2 > 0 ? n2 : "") + e5.content.toString();
    }).join("");
    return this.intro + e4;
  }
  isEmpty() {
    return (!this.intro.length || !this.intro.trim()) && !this.sources.some((e4) => !e4.content.isEmpty());
  }
  length() {
    return this.sources.reduce((e4, t2) => e4 + t2.content.length(), this.intro.length);
  }
  trimLines() {
    return this.trim("[\\r\\n]");
  }
  trim(e4) {
    return this.trimStart(e4).trimEnd(e4);
  }
  trimStart(e4) {
    const t2 = new RegExp("^" + (e4 || "\\s") + "+");
    if (this.intro = this.intro.replace(t2, ""), !this.intro) {
      let t3, n2 = 0;
      do {
        if (t3 = this.sources[n2++], !t3)
          break;
      } while (!t3.content.trimStartAborted(e4));
    }
    return this;
  }
  trimEnd(e4) {
    const t2 = new RegExp((e4 || "\\s") + "+$");
    let n2, s2 = this.sources.length - 1;
    do {
      if (n2 = this.sources[s2--], !n2) {
        this.intro = this.intro.replace(t2, "");
        break;
      }
    } while (!n2.content.trimEndAborted(e4));
    return this;
  }
};
const E = /^(?:\/|(?:[A-Za-z]:)?[/\\|])/, x = /^\.?\.\//, $ = /\\/g, A = /[/\\]/, S = /\.[^.]+$/;
function w(e4) {
  return E.test(e4);
}
function v(e4) {
  return x.test(e4);
}
function P(e4) {
  return e4.replace($, "/");
}
function I(e4) {
  return e4.split(A).pop() || "";
}
function k(e4) {
  const t2 = /[/\\][^/\\]*$/.exec(e4);
  if (!t2)
    return ".";
  return e4.slice(0, -t2[0].length) || "/";
}
function N(e4) {
  const t2 = S.exec(I(e4));
  return t2 ? t2[0] : "";
}
function C(e4, t2) {
  const n2 = e4.split(A).filter(Boolean), s2 = t2.split(A).filter(Boolean);
  for ("." === n2[0] && n2.shift(), "." === s2[0] && s2.shift(); n2[0] && s2[0] && n2[0] === s2[0]; )
    n2.shift(), s2.shift();
  for (; ".." === s2[0] && n2.length > 0; )
    s2.shift(), n2.pop();
  for (; n2.pop(); )
    s2.unshift("..");
  return s2.join("/");
}
function O(...e4) {
  const t2 = e4.shift();
  if (!t2)
    return "/";
  let n2 = t2.split(A);
  for (const t3 of e4)
    if (w(t3))
      n2 = t3.split(A);
    else {
      const e5 = t3.split(A);
      for (; "." === e5[0] || ".." === e5[0]; ) {
        ".." === e5.shift() && n2.pop();
      }
      n2.push(...e5);
    }
  return n2.join("/");
}
const D = /[\n\r'\\\u2028\u2029]/, M = /([\n\r'\u2028\u2029])/g, R = /\\/g;
function _(e4) {
  return D.test(e4) ? e4.replace(R, "\\\\").replace(M, "\\$1") : e4;
}
function L(e4) {
  const t2 = I(e4);
  return t2.slice(0, Math.max(0, t2.length - N(e4).length));
}
function B(e4) {
  return w(e4) ? C(O(), e4) : e4;
}
function T(e4) {
  return "/" === e4[0] || "." === e4[0] && ("/" === e4[1] || "." === e4[1]) || w(e4);
}
const z = /^(\.\.\/)*\.\.$/;
function V(e4, t2, n2, s2) {
  for (; t2.startsWith("../"); )
    t2 = t2.slice(3), e4 = "_/" + e4;
  let i2 = P(C(k(e4), t2));
  if (n2 && i2.endsWith(".js") && (i2 = i2.slice(0, -3)), s2) {
    if ("" === i2)
      return "../" + I(t2);
    if (z.test(i2))
      return [...i2.split("/"), "..", I(t2)].join("/");
  }
  return i2 ? i2.startsWith("..") ? i2 : "./" + i2 : ".";
}
class F {
  constructor(e4, t2, n2) {
    this.options = t2, this.inputBase = n2, this.defaultVariableName = "", this.namespaceVariableName = "", this.variableName = "", this.fileName = null, this.importAttributes = null, this.id = e4.id, this.moduleInfo = e4.info, this.renormalizeRenderPath = e4.renormalizeRenderPath, this.suggestedVariableName = e4.suggestedVariableName;
  }
  getFileName() {
    if (this.fileName)
      return this.fileName;
    const { paths: e4 } = this.options;
    return this.fileName = ("function" == typeof e4 ? e4(this.id) : e4[this.id]) || (this.renormalizeRenderPath ? P(C(this.inputBase, this.id)) : this.id);
  }
  getImportAttributes(e4) {
    return this.importAttributes || (this.importAttributes = function(e5, { getObject: t2 }) {
      if (!e5)
        return null;
      const n2 = Object.entries(e5).map(([e6, t3]) => [e6, `'${t3}'`]);
      if (n2.length > 0)
        return t2(n2, { lineBreakIndent: null });
      return null;
    }("es" === this.options.format && this.options.externalImportAttributes && this.moduleInfo.attributes, e4));
  }
  getImportPath(e4) {
    return _(this.renormalizeRenderPath ? V(e4, this.getFileName(), "amd" === this.options.format, false) : this.getFileName());
  }
}
function j(e4, t2, n2) {
  const s2 = e4.get(t2);
  if (void 0 !== s2)
    return s2;
  const i2 = n2();
  return e4.set(t2, i2), i2;
}
function U() {
  return /* @__PURE__ */ new Set();
}
function G() {
  return [];
}
const W = Symbol("Unknown Key"), q = Symbol("Unknown Non-Accessor Key"), H = Symbol("Unknown Integer"), K = Symbol("Symbol.toStringTag"), Y = [], J = [W], X = [q], Z = [H], Q = Symbol("Entities");
class ee {
  constructor() {
    this.entityPaths = Object.create(null, { [Q]: { value: /* @__PURE__ */ new Set() } });
  }
  trackEntityAtPathAndGetIfTracked(e4, t2) {
    const n2 = this.getEntities(e4);
    return !!n2.has(t2) || (n2.add(t2), false);
  }
  withTrackedEntityAtPath(e4, t2, n2, s2) {
    const i2 = this.getEntities(e4);
    if (i2.has(t2))
      return s2;
    i2.add(t2);
    const r2 = n2();
    return i2.delete(t2), r2;
  }
  getEntities(e4) {
    let t2 = this.entityPaths;
    for (const n2 of e4)
      t2 = t2[n2] = t2[n2] || Object.create(null, { [Q]: { value: /* @__PURE__ */ new Set() } });
    return t2[Q];
  }
}
const te = new ee();
class ne {
  constructor() {
    this.entityPaths = Object.create(null, { [Q]: { value: /* @__PURE__ */ new Map() } });
  }
  trackEntityAtPathAndGetIfTracked(e4, t2, n2) {
    let s2 = this.entityPaths;
    for (const t3 of e4)
      s2 = s2[t3] = s2[t3] || Object.create(null, { [Q]: { value: /* @__PURE__ */ new Map() } });
    const i2 = j(s2[Q], t2, U);
    return !!i2.has(n2) || (i2.add(n2), false);
  }
}
function se(e4, t2) {
  return !!(e4 & t2);
}
function ie(e4, t2, n2) {
  return e4 & ~t2 | -n2 & t2;
}
const re = Symbol("Unknown Value"), oe = Symbol("Unknown Truthy Value");
class ae {
  constructor() {
    this.flags = 0;
  }
  get included() {
    return se(this.flags, 1);
  }
  set included(e4) {
    this.flags = ie(this.flags, 1, e4);
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    ue(e4);
  }
  deoptimizePath(e4) {
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return re;
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return ce;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return true;
  }
  include(e4, t2, n2) {
    this.included = true;
  }
  includeCallArguments(e4, t2) {
    for (const n2 of t2)
      n2.include(e4, false);
  }
  shouldBeIncluded(e4) {
    return true;
  }
}
const le = new class extends ae {
}(), ce = [le, false], ue = (e4) => {
  for (const t2 of e4.args)
    t2 == null ? void 0 : t2.deoptimizePath(J);
}, de = { args: [null], type: 0 }, he = { args: [null, le], type: 1 }, pe = { args: [null], type: 2, withNew: false }, fe = "ArrowFunctionExpression", me = "CallExpression", ge = "ExportDefaultDeclaration", ye = "ExpressionStatement", be = "Identifier", Ee = "Program";
class xe extends ae {
  markReassigned() {
    this.isReassigned = true;
  }
  constructor(e4) {
    super(), this.name = e4, this.alwaysRendered = false, this.forbiddenNames = null, this.initReached = false, this.isId = false, this.kind = null, this.renderBaseName = null, this.renderName = null, this.isReassigned = false, this.onlyFunctionCallUsed = true;
  }
  addReference(e4) {
  }
  getOnlyFunctionCallUsed() {
    return this.onlyFunctionCallUsed;
  }
  addUsedPlace(e4) {
    e4.parent.type === me && e4.parent.callee === e4 || e4.parent.type === ge || (this.onlyFunctionCallUsed = false);
  }
  forbidName(e4) {
    (this.forbiddenNames || (this.forbiddenNames = /* @__PURE__ */ new Set())).add(e4);
  }
  getBaseVariableName() {
    var _a3;
    return ((_a3 = this.renderedLikeHoisted) == null ? void 0 : _a3.getBaseVariableName()) || this.renderBaseName || this.renderName || this.name;
  }
  getName(e4, t2) {
    if (t2 == null ? void 0 : t2(this))
      return this.name;
    if (this.renderedLikeHoisted)
      return this.renderedLikeHoisted.getName(e4, t2);
    const n2 = this.renderName || this.name;
    return this.renderBaseName ? `${this.renderBaseName}${e4(n2)}` : n2;
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }, n2) {
    return 0 !== t2 || e4.length > 0;
  }
  include() {
    var _a3;
    this.included = true, (_a3 = this.renderedLikeHoisted) == null ? void 0 : _a3.include();
  }
  renderLikeHoisted(e4) {
    this.renderedLikeHoisted = e4;
  }
  markCalledFromTryStatement() {
  }
  setRenderNames(e4, t2) {
    this.renderBaseName = e4, this.renderName = t2;
  }
}
class $e extends xe {
  constructor(e4, t2) {
    super(t2), this.referenced = false, this.module = e4, this.isNamespace = "*" === t2;
  }
  addReference(e4) {
    this.referenced = true, "default" !== this.name && "*" !== this.name || this.module.suggestName(e4.name);
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }) {
    return 0 !== t2 || e4.length > (this.isNamespace ? 1 : 0);
  }
  include() {
    super.include(), this.module.used = true;
  }
}
const Ae = Object.freeze(/* @__PURE__ */ Object.create(null)), Se = Object.freeze({}), we = Object.freeze([]), ve = Object.freeze(new class extends Set {
  add() {
    throw new Error("Cannot add to empty set");
  }
}());
function Pe(e4, t2) {
  for (const n2 of t2) {
    const t3 = Object.getOwnPropertyDescriptor(e4, n2).get;
    Object.defineProperty(e4, n2, { get() {
      const s2 = t3.call(e4);
      return Object.defineProperty(e4, n2, { value: s2 }), s2;
    } });
  }
}
const Ie = /* @__PURE__ */ new Set(["await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "eval", "export", "extends", "false", "finally", "for", "function", "if", "implements", "import", "in", "instanceof", "interface", "let", "NaN", "new", "null", "package", "private", "protected", "public", "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof", "undefined", "var", "void", "while", "with", "yield"]), ke = /[^\w$]/g, Ne = (e4) => ((e5) => /\d/.test(e5[0]))(e4) || Ie.has(e4) || "arguments" === e4;
function Ce(e4) {
  return e4 = e4.replace(/-(\w)/g, (e5, t2) => t2.toUpperCase()).replace(ke, "_"), Ne(e4) && (e4 = `_${e4}`), e4 || "_";
}
const Oe = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u, De = /^(?:0|[1-9]\d*)$/;
function Me(e4) {
  return Oe.test(e4) ? "__proto__" === e4 ? '["__proto__"]' : e4 : De.test(e4) && +e4 <= Number.MAX_SAFE_INTEGER ? e4 : JSON.stringify(e4);
}
function Re(e4) {
  return Oe.test(e4) ? e4 : JSON.stringify(e4);
}
const _e = "silent", Le = "warn", Be = "info", Te = "debug", ze = { [Te]: 0, [Be]: 1, [_e]: 3, [Le]: 2 };
function Ve(e4, t2) {
  return e4.start <= t2 && t2 < e4.end;
}
function Fe(e4, t2, n2) {
  return function(e5, t3 = {}) {
    const { offsetLine: n3 = 0, offsetColumn: s2 = 0 } = t3;
    let i2 = 0;
    const r2 = e5.split("\n").map((e6, t4) => {
      const n4 = i2 + e6.length + 1, s3 = { start: i2, end: n4, line: t4 };
      return i2 = n4, s3;
    });
    let o2 = 0;
    return function(t4, i3) {
      if ("string" == typeof t4 && (t4 = e5.indexOf(t4, i3 ?? 0)), -1 === t4)
        return;
      let a2 = r2[o2];
      const l2 = t4 >= a2.end ? 1 : -1;
      for (; a2; ) {
        if (Ve(a2, t4))
          return { line: n3 + a2.line, column: s2 + t4 - a2.start, character: t4 };
        o2 += l2, a2 = r2[o2];
      }
    };
  }(e4, n2)(t2, n2 && n2.startIndex);
}
function je(e4) {
  return e4.replace(/^\t+/, (e5) => e5.split("	").join("  "));
}
const Ue = 120, Ge = 10, We = "...";
function qe(e4, t2, n2) {
  let s2 = e4.split("\n");
  if (t2 > s2.length)
    return "";
  const i2 = Math.max(je(s2[t2 - 1].slice(0, n2)).length + Ge + We.length, Ue), r2 = Math.max(0, t2 - 3);
  let o2 = Math.min(t2 + 2, s2.length);
  for (s2 = s2.slice(r2, o2); !/\S/.test(s2[s2.length - 1]); )
    s2.pop(), o2 -= 1;
  const a2 = String(o2).length;
  return s2.map((e5, s3) => {
    const o3 = r2 + s3 + 1 === t2;
    let l2 = String(s3 + r2 + 1);
    for (; l2.length < a2; )
      l2 = ` ${l2}`;
    let c2 = je(e5);
    if (c2.length > i2 && (c2 = `${c2.slice(0, i2 - We.length)}${We}`), o3) {
      const t3 = function(e6) {
        let t4 = "";
        for (; e6--; )
          t4 += " ";
        return t4;
      }(a2 + 2 + je(e5.slice(0, n2)).length) + "^";
      return `${l2}: ${c2}
${t3}`;
    }
    return `${l2}: ${c2}`;
  }).join("\n");
}
function He(e4, t2) {
  const n2 = e4.length <= 1, s2 = e4.map((e5) => `"${e5}"`);
  let i2 = n2 ? s2[0] : `${s2.slice(0, -1).join(", ")} and ${s2.slice(-1)[0]}`;
  return t2 && (i2 += ` ${n2 ? t2[0] : t2[1]}`), i2;
}
function Ke(e4) {
  return `https://rollupjs.org/${e4}`;
}
const Ye = "troubleshooting/#error-name-is-not-exported-by-module", Je = "troubleshooting/#warning-sourcemap-is-likely-to-be-incorrect", Xe = "configuration-options/#output-amd-id", Ze = "configuration-options/#output-dir", Qe = "configuration-options/#output-exports", et = "configuration-options/#output-extend", tt = "configuration-options/#output-format", nt = "configuration-options/#output-globals", st = "configuration-options/#output-inlinedynamicimports", it = "configuration-options/#output-interop", rt = "configuration-options/#output-manualchunks", ot = "configuration-options/#output-name", at = "configuration-options/#output-sourcemapfile";
function lt(e4) {
  throw e4 instanceof Error ? e4 : ct(e4);
}
function ct(e4) {
  ht(e4);
  const t2 = Object.assign(new Error(e4.message), e4);
  return Object.defineProperty(t2, "name", { value: "RollupError", writable: true }), t2;
}
function ut(e4, t2, n2, s2) {
  if ("object" == typeof t2) {
    const { line: n3, column: i2 } = t2;
    e4.loc = { column: i2, file: s2, line: n3 };
  } else {
    e4.pos = t2;
    const i2 = Fe(n2, t2, { offsetLine: 1 });
    if (!i2)
      return;
    const { line: r2, column: o2 } = i2;
    e4.loc = { column: o2, file: s2, line: r2 };
  }
  if (void 0 === e4.frame) {
    const { line: t3, column: s3 } = e4.loc;
    e4.frame = qe(n2, t3, s3);
  }
}
const dt = Symbol("augmented");
function ht(e4) {
  var _a3;
  if (!e4.plugin && !e4.loc || e4[dt])
    return;
  e4[dt] = true;
  let t2 = "";
  e4.plugin && (t2 += `[plugin ${e4.plugin}] `);
  const n2 = e4.id || ((_a3 = e4.loc) == null ? void 0 : _a3.file);
  if (n2) {
    const s2 = e4.loc ? ` (${e4.loc.line}:${e4.loc.column})` : "";
    t2 += `${B(n2)}${s2}: `;
  }
  e4.message = t2 + e4.message;
}
const pt = "ADDON_ERROR", ft = "ALREADY_CLOSED", mt = "ANONYMOUS_PLUGIN_CACHE", gt = "ASSET_NOT_FINALISED", yt = "CANNOT_EMIT_FROM_OPTIONS_HOOK", bt = "CHUNK_NOT_GENERATED", Et = "CIRCULAR_REEXPORT", xt = "DEPRECATED_FEATURE", $t = "DUPLICATE_PLUGIN_NAME", At = "FILE_NAME_CONFLICT", St = "ILLEGAL_IDENTIFIER_AS_NAME", wt = "INVALID_CHUNK", vt = "INVALID_EXPORT_OPTION", Pt = "INVALID_IMPORT_ATTRIBUTE", It = "INVALID_LOG_POSITION", kt = "INVALID_OPTION", Nt = "INVALID_PLUGIN_HOOK", Ct = "INVALID_SETASSETSOURCE", Ot = "MISSING_EXPORT", Dt = "MISSING_GLOBAL_NAME", Mt = "MISSING_IMPLICIT_DEPENDANT", Rt = "MISSING_NAME_OPTION_FOR_IIFE_EXPORT", _t = "MISSING_NODE_BUILTINS", Lt = "MISSING_OPTION", Bt = "MIXED_EXPORTS", Tt = "NO_TRANSFORM_MAP_OR_AST_WITHOUT_CODE", zt = "OPTIMIZE_CHUNK_STATUS", Vt = "PARSE_ERROR", Ft = "PLUGIN_ERROR", jt = "SOURCEMAP_BROKEN", Ut = "UNEXPECTED_NAMED_IMPORT", Gt = "UNKNOWN_OPTION", Wt = "UNRESOLVED_ENTRY", qt = "UNRESOLVED_IMPORT", Ht = "VALIDATION_ERROR";
function Kt() {
  return { code: ft, message: 'Bundle is already closed, no more calls to "generate" or "write" are allowed.' };
}
function Yt(e4) {
  return { code: "CANNOT_CALL_NAMESPACE", message: `Cannot call a namespace ("${e4}").` };
}
function Jt({ fileName: e4, code: t2 }, { pos: n2, message: s2 }) {
  const i2 = { code: "CHUNK_INVALID", message: `Chunk "${e4}" is not valid JavaScript: ${s2}.` };
  return ut(i2, n2, t2, e4), i2;
}
function Xt(e4) {
  return { code: "CIRCULAR_DEPENDENCY", ids: e4, message: `Circular dependency: ${e4.map(B).join(" -> ")}` };
}
function Zt(e4, t2, { line: n2, column: s2 }) {
  return { code: "FIRST_SIDE_EFFECT", message: `First side effect in ${B(t2)} is at (${n2}:${s2})
${qe(e4, n2, s2)}` };
}
function Qt(e4, t2) {
  return { code: "ILLEGAL_REASSIGNMENT", message: `Illegal reassignment of import "${e4}" in "${B(t2)}".` };
}
function en(e4, t2, n2, s2) {
  return { code: "INCONSISTENT_IMPORT_ATTRIBUTES", message: `Module "${B(s2)}" tried to import "${B(n2)}" with ${tn(t2)} attributes, but it was already imported elsewhere with ${tn(e4)} attributes. Please ensure that import attributes for the same module are always consistent.` };
}
const tn = (e4) => {
  const t2 = Object.entries(e4);
  return 0 === t2.length ? "no" : t2.map(([e5, t3]) => `"${e5}": "${t3}"`).join(", ");
};
function nn(e4, t2, n2) {
  return { code: "INVALID_ANNOTATION", id: t2, message: `A comment

"${e4}"

in "${B(t2)}" contains an annotation that Rollup cannot interpret due to the position of the comment. The comment will be removed to avoid issues.`, url: Ke("noSideEffects" === n2 ? "configuration-options/#no-side-effects" : "configuration-options/#pure") };
}
function sn(e4, t2, n2) {
  return { code: vt, message: `"${e4}" was specified for "output.exports", but entry module "${B(n2)}" has the following exports: ${He(t2)}`, url: Ke(Qe) };
}
function rn(e4) {
  return { code: Pt, message: `Rollup could not statically analyze an import attribute of a dynamic import in "${B(e4)}". Import attributes need to have string keys and values. The attribute will be removed.` };
}
function on(e4, t2, n2, s2) {
  return { code: kt, message: `Invalid value ${void 0 === s2 ? "" : `${JSON.stringify(s2)} `}for option "${e4}" - ${n2}.`, url: Ke(t2) };
}
function an(e4, t2, n2) {
  const s2 = ".json" === N(n2);
  return { binding: e4, code: Ot, exporter: n2, id: t2, message: `"${e4}" is not exported by "${B(n2)}", imported by "${B(t2)}".${s2 ? " (Note that you need @rollup/plugin-json to import JSON files)" : ""}`, url: Ke(Ye) };
}
function ln(e4) {
  const t2 = [...e4.implicitlyLoadedBefore].map((e5) => B(e5.id)).sort();
  return { code: Mt, message: `Module "${B(e4.id)}" that should be implicitly loaded before ${He(t2)} is not included in the module graph. Either it was not imported by an included module or only via a tree-shaken dynamic import, or no imported bindings were used and it had otherwise no side-effects.` };
}
function cn(e4, t2, n2) {
  return { code: zt, message: `${n2}, there are
${e4} chunks, of which
${t2} are below minChunkSize.` };
}
function un(e4, t2) {
  return { code: Vt, message: e4, pos: t2 };
}
function dn(e4) {
  return { code: "REDECLARATION_ERROR", message: `Identifier "${e4}" has already been declared` };
}
function hn(e4, t2) {
  let n2 = e4.message.replace(/ \(\d+:\d+\)$/, "");
  return t2.endsWith(".json") ? n2 += " (Note that you need @rollup/plugin-json to import JSON files)" : t2.endsWith(".js") || (n2 += " (Note that you need plugins to import files that are not JavaScript)"), { cause: e4, code: Vt, id: t2, message: n2, stack: e4.stack };
}
function pn(e4, t2, { hook: n2, id: s2 } = {}) {
  const i2 = e4.code;
  return e4.pluginCode || null == i2 || "string" == typeof i2 && i2.startsWith("PLUGIN_") || (e4.pluginCode = i2), e4.code = Ft, e4.plugin = t2, n2 && (e4.hook = n2), s2 && (e4.id = s2), e4;
}
function fn(e4) {
  return { code: jt, message: `Multiple conflicting contents for sourcemap source ${e4}` };
}
function mn(e4, t2, n2) {
  const s2 = n2 ? "reexport" : "import";
  return { code: Ut, exporter: e4, message: `The named export "${t2}" was ${s2}ed from the external module "${B(e4)}" even though its interop type is "defaultOnly". Either remove or change this ${s2} or change the value of the "output.interop" option.`, url: Ke(it) };
}
function gn(e4) {
  return { code: Ut, exporter: e4, message: `There was a namespace "*" reexport from the external module "${B(e4)}" even though its interop type is "defaultOnly". This will be ignored as namespace reexports only reexport named exports. If this is not intended, either remove or change this reexport or change the value of the "output.interop" option.`, url: Ke(it) };
}
function yn(e4) {
  return { code: Ht, message: e4 };
}
function bn(e4, t2, n2, s2, i2) {
  !function(e5, t3, n3, s3, i3, r2) {
    {
      const n4 = function(e6, t4, n5) {
        return { code: xt, message: e6, url: Ke(t4) };
      }(e5, t3);
      if (i3)
        return lt(n4);
      s3(Le, n4);
    }
  }(e4, t2, 0, s2.onLog, s2.strictDeprecations);
}
class En {
  constructor(e4, t2, n2, s2, i2, r2) {
    this.options = e4, this.id = t2, this.renormalizeRenderPath = i2, this.dynamicImporters = [], this.execIndex = 1 / 0, this.exportedVariables = /* @__PURE__ */ new Map(), this.importers = [], this.reexported = false, this.used = false, this.declarations = /* @__PURE__ */ new Map(), this.mostCommonSuggestion = 0, this.nameSuggestions = /* @__PURE__ */ new Map(), this.suggestedVariableName = Ce(t2.split(/[/\\]/).pop());
    const { importers: o2, dynamicImporters: a2 } = this;
    this.info = { ast: null, attributes: r2, code: null, dynamicallyImportedIdResolutions: we, dynamicallyImportedIds: we, get dynamicImporters() {
      return a2.sort();
    }, exportedBindings: null, exports: null, hasDefaultExport: null, id: t2, implicitlyLoadedAfterOneOf: we, implicitlyLoadedBefore: we, importedIdResolutions: we, importedIds: we, get importers() {
      return o2.sort();
    }, isEntry: false, isExternal: true, isIncluded: null, meta: s2, moduleSideEffects: n2, syntheticNamedExports: false };
  }
  cacheInfoGetters() {
    Pe(this.info, ["dynamicImporters", "importers"]);
  }
  getVariableForExportName(e4) {
    const t2 = this.declarations.get(e4);
    if (t2)
      return [t2];
    const n2 = new $e(this, e4);
    return this.declarations.set(e4, n2), this.exportedVariables.set(n2, e4), [n2];
  }
  suggestName(e4) {
    const t2 = (this.nameSuggestions.get(e4) ?? 0) + 1;
    this.nameSuggestions.set(e4, t2), t2 > this.mostCommonSuggestion && (this.mostCommonSuggestion = t2, this.suggestedVariableName = e4);
  }
  warnUnusedImports() {
    const e4 = [...this.declarations].filter(([e5, t3]) => "*" !== e5 && !t3.included && !this.reexported && !t3.referenced).map(([e5]) => e5);
    if (0 === e4.length)
      return;
    const t2 = /* @__PURE__ */ new Set();
    for (const n3 of e4)
      for (const e5 of this.declarations.get(n3).module.importers)
        t2.add(e5);
    const n2 = [...t2];
    var s2, i2, r2;
    this.options.onLog(Le, { code: "UNUSED_EXTERNAL_IMPORT", exporter: s2 = this.id, ids: r2 = n2, message: `${He(i2 = e4, ["is", "are"])} imported from external module "${s2}" but never used in ${He(r2.map((e5) => B(e5)))}.`, names: i2 });
  }
}
const xn = { ArrayPattern(e4, t2) {
  for (const n2 of t2.elements)
    n2 && xn[n2.type](e4, n2);
}, AssignmentPattern(e4, t2) {
  xn[t2.left.type](e4, t2.left);
}, Identifier(e4, t2) {
  e4.push(t2.name);
}, MemberExpression() {
}, ObjectPattern(e4, t2) {
  for (const n2 of t2.properties)
    "RestElement" === n2.type ? xn.RestElement(e4, n2) : xn[n2.value.type](e4, n2.value);
}, RestElement(e4, t2) {
  xn[t2.argument.type](e4, t2.argument);
} }, $n = function(e4) {
  const t2 = [];
  return xn[e4.type](t2, e4), t2;
};
let An;
new Set("break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield enum await implements package protected static interface private public arguments Infinity NaN undefined null true false eval uneval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Symbol Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Number Math Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Map Set WeakMap WeakSet SIMD ArrayBuffer DataView JSON Promise Generator GeneratorFunction Reflect Proxy Intl".split(" ")).add("");
const Sn = new Array(128).fill(void 0);
function wn(e4) {
  return Sn[e4];
}
Sn.push(void 0, null, true, false);
let vn = Sn.length;
function Pn(e4) {
  const t2 = wn(e4);
  return function(e5) {
    e5 < 132 || (Sn[e5] = vn, vn = e5);
  }(e4), t2;
}
const In = "undefined" != typeof TextDecoder ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }) : { decode: () => {
  throw Error("TextDecoder not available");
} };
"undefined" != typeof TextDecoder && In.decode();
let kn = null;
function Nn() {
  return null !== kn && 0 !== kn.byteLength || (kn = new Uint8Array(An.memory.buffer)), kn;
}
function Cn(e4, t2) {
  return e4 >>>= 0, In.decode(Nn().subarray(e4, e4 + t2));
}
function On(e4) {
  vn === Sn.length && Sn.push(Sn.length + 1);
  const t2 = vn;
  return vn = Sn[t2], Sn[t2] = e4, t2;
}
let Dn = 0;
const Mn = "undefined" != typeof TextEncoder ? new TextEncoder("utf-8") : { encode: () => {
  throw Error("TextEncoder not available");
} }, Rn = "function" == typeof Mn.encodeInto ? function(e4, t2) {
  return Mn.encodeInto(e4, t2);
} : function(e4, t2) {
  const n2 = Mn.encode(e4);
  return t2.set(n2), { read: e4.length, written: n2.length };
};
let _n = null;
function Ln() {
  return null !== _n && 0 !== _n.byteLength || (_n = new Int32Array(An.memory.buffer)), _n;
}
function Bn(e4, t2) {
  try {
    const a2 = An.__wbindgen_add_to_stack_pointer(-16), l2 = function(e5, t3, n3) {
      if (void 0 === n3) {
        const n4 = Mn.encode(e5), s4 = t3(n4.length, 1) >>> 0;
        return Nn().subarray(s4, s4 + n4.length).set(n4), Dn = n4.length, s4;
      }
      let s3 = e5.length, i3 = t3(s3, 1) >>> 0;
      const r3 = Nn();
      let o3 = 0;
      for (; o3 < s3; o3++) {
        const t4 = e5.charCodeAt(o3);
        if (t4 > 127)
          break;
        r3[i3 + o3] = t4;
      }
      if (o3 !== s3) {
        0 !== o3 && (e5 = e5.slice(o3)), i3 = n3(i3, s3, s3 = o3 + 3 * e5.length, 1) >>> 0;
        const t4 = Nn().subarray(i3 + o3, i3 + s3);
        o3 += Rn(e5, t4).written, i3 = n3(i3, s3, o3, 1) >>> 0;
      }
      return Dn = o3, i3;
    }(e4, An.__wbindgen_export_0, An.__wbindgen_export_1), c2 = Dn;
    An.parse(a2, l2, c2, t2);
    var n2 = Ln()[a2 / 4 + 0], s2 = Ln()[a2 / 4 + 1], i2 = (r2 = n2, o2 = s2, r2 >>>= 0, Nn().subarray(r2 / 1, r2 / 1 + o2)).slice();
    return An.__wbindgen_export_2(n2, 1 * s2, 1), i2;
  } finally {
    An.__wbindgen_add_to_stack_pointer(16);
  }
  var r2, o2;
}
function Tn(e4, t2) {
  try {
    return e4.apply(this, t2);
  } catch (e5) {
    An.__wbindgen_export_3(On(e5));
  }
}
function zn() {
  const e4 = { wbg: {} };
  return e4.wbg.__wbindgen_object_drop_ref = function(e5) {
    Pn(e5);
  }, e4.wbg.__wbindgen_is_object = function(e5) {
    const t2 = wn(e5);
    return "object" == typeof t2 && null !== t2;
  }, e4.wbg.__wbg_crypto_1d1f22824a6a080c = function(e5) {
    return On(wn(e5).crypto);
  }, e4.wbg.__wbg_process_4a72847cc503995b = function(e5) {
    return On(wn(e5).process);
  }, e4.wbg.__wbg_versions_f686565e586dd935 = function(e5) {
    return On(wn(e5).versions);
  }, e4.wbg.__wbg_node_104a2ff8d6ea03a2 = function(e5) {
    return On(wn(e5).node);
  }, e4.wbg.__wbindgen_is_string = function(e5) {
    return "string" == typeof wn(e5);
  }, e4.wbg.__wbg_msCrypto_eb05e62b530a1508 = function(e5) {
    return On(wn(e5).msCrypto);
  }, e4.wbg.__wbg_require_cca90b1a94a0255b = function() {
    return Tn(function() {
      return On(module.require);
    }, arguments);
  }, e4.wbg.__wbindgen_string_new = function(e5, t2) {
    return On(Cn(e5, t2));
  }, e4.wbg.__wbg_randomFillSync_5c9c955aa56b6049 = function() {
    return Tn(function(e5, t2) {
      wn(e5).randomFillSync(Pn(t2));
    }, arguments);
  }, e4.wbg.__wbg_getRandomValues_3aa56aa6edec874c = function() {
    return Tn(function(e5, t2) {
      wn(e5).getRandomValues(wn(t2));
    }, arguments);
  }, e4.wbg.__wbg_newnoargs_e258087cd0daa0ea = function(e5, t2) {
    return On(new Function(Cn(e5, t2)));
  }, e4.wbg.__wbindgen_is_function = function(e5) {
    return "function" == typeof wn(e5);
  }, e4.wbg.__wbg_self_ce0dbfc45cf2f5be = function() {
    return Tn(function() {
      return On(self.self);
    }, arguments);
  }, e4.wbg.__wbg_window_c6fb939a7f436783 = function() {
    return Tn(function() {
      return On(window.window);
    }, arguments);
  }, e4.wbg.__wbg_globalThis_d1e6af4856ba331b = function() {
    return Tn(function() {
      return On(globalThis.globalThis);
    }, arguments);
  }, e4.wbg.__wbg_global_207b558942527489 = function() {
    return Tn(function() {
      return On(global.global);
    }, arguments);
  }, e4.wbg.__wbindgen_is_undefined = function(e5) {
    return void 0 === wn(e5);
  }, e4.wbg.__wbg_call_27c0f87801dedf93 = function() {
    return Tn(function(e5, t2) {
      return On(wn(e5).call(wn(t2)));
    }, arguments);
  }, e4.wbg.__wbg_call_b3ca7c6051f9bec1 = function() {
    return Tn(function(e5, t2, n2) {
      return On(wn(e5).call(wn(t2), wn(n2)));
    }, arguments);
  }, e4.wbg.__wbg_buffer_12d079cc21e14bdb = function(e5) {
    return On(wn(e5).buffer);
  }, e4.wbg.__wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb = function(e5, t2, n2) {
    return On(new Uint8Array(wn(e5), t2 >>> 0, n2 >>> 0));
  }, e4.wbg.__wbg_new_63b92bc8671ed464 = function(e5) {
    return On(new Uint8Array(wn(e5)));
  }, e4.wbg.__wbg_newwithlength_e9b4878cebadb3d3 = function(e5) {
    return On(new Uint8Array(e5 >>> 0));
  }, e4.wbg.__wbg_subarray_a1f73cd4b5b42fe1 = function(e5, t2, n2) {
    return On(wn(e5).subarray(t2 >>> 0, n2 >>> 0));
  }, e4.wbg.__wbg_length_c20a40f15020d68a = function(e5) {
    return wn(e5).length;
  }, e4.wbg.__wbg_set_a47bac70306a19a7 = function(e5, t2, n2) {
    wn(e5).set(wn(t2), n2 >>> 0);
  }, e4.wbg.__wbindgen_object_clone_ref = function(e5) {
    return On(wn(e5));
  }, e4.wbg.__wbindgen_throw = function(e5, t2) {
    throw new Error(Cn(e5, t2));
  }, e4.wbg.__wbindgen_memory = function() {
    return On(An.memory);
  }, e4;
}
async function Vn(e4) {
  if (void 0 !== An)
    return An;
  void 0 === e4 && (e4 = new URL("http://localhost:4175/0.0.2/assets/bindings_wasm_bg-D_w-mH2m.wasm", import.meta.url));
  const t2 = zn();
  ("string" == typeof e4 || "function" == typeof Request && e4 instanceof Request || "function" == typeof URL && e4 instanceof URL) && (e4 = fetch(e4));
  const { instance: n2, module: s2 } = await async function(e5, t3) {
    if ("function" == typeof Response && e5 instanceof Response) {
      if ("function" == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(e5, t3);
        } catch (t4) {
          if ("application/wasm" == e5.headers.get("Content-Type"))
            throw t4;
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", t4);
        }
      const n3 = await e5.arrayBuffer();
      return await WebAssembly.instantiate(n3, t3);
    }
    {
      const n3 = await WebAssembly.instantiate(e5, t3);
      return n3 instanceof WebAssembly.Instance ? { instance: n3, module: e5 } : n3;
    }
  }(await e4, t2);
  return function(e5, t3) {
    return An = e5.exports, Vn.__wbindgen_wasm_module = t3, _n = null, kn = null, An;
  }(n2, s2);
}
function Fn() {
  return { brokenFlow: false, hasBreak: false, hasContinue: false, includedCallArguments: /* @__PURE__ */ new Set(), includedLabels: /* @__PURE__ */ new Set() };
}
function jn() {
  return { accessed: new ee(), assigned: new ee(), brokenFlow: false, called: new ne(), hasBreak: false, hasContinue: false, ignore: { breaks: false, continues: false, labels: /* @__PURE__ */ new Set(), returnYield: false, this: false }, includedLabels: /* @__PURE__ */ new Set(), instantiated: new ne(), replacedVariableInits: /* @__PURE__ */ new Map() };
}
var Un = ["var", "let", "const", "init", "get", "set", "constructor", "method", "-", "+", "!", "~", "typeof", "void", "delete", "++", "--", "==", "!=", "===", "!==", "<", "<=", ">", ">=", "<<", ">>", ">>>", "+", "-", "*", "/", "%", "|", "^", "&", "||", "&&", "in", "instanceof", "**", "??", "=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", ">>>=", "|=", "^=", "&=", "**=", "&&=", "||=", "??=", "pure", "noSideEffects", "sourcemap", "using", "await using"];
const Gn = "_rollupAnnotations", Wn = "_rollupRemoved", qn = (e4, t2) => {
  if (0 === e4)
    return we;
  const n2 = t2[e4++], s2 = [];
  for (let i2 = 0; i2 < n2; i2++)
    s2.push(Hn(t2[e4++], t2));
  return s2;
}, Hn = (e4, t2) => {
  const n2 = t2[e4++];
  return { end: t2[e4++], start: n2, type: Un[t2[e4]] };
}, Kn = (e4, t2, n2) => {
  const s2 = t2[e4++];
  return n2(e4 << 2, s2);
};
const Yn = [function(e4, t2, n2) {
  return { type: "PanicError", start: t2[e4++], end: t2[e4++], message: Kn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ParseError", start: t2[e4++], end: t2[e4++], message: Kn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ArrayExpression", start: t2[e4++], end: t2[e4++], elements: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ArrayPattern", start: t2[e4++], end: t2[e4++], elements: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = !(1 & ~r2), a2 = !(2 & ~r2), l2 = !(4 & ~r2), c2 = qn(t2[e4++], t2), u2 = Xn(t2[e4++], t2, n2), d2 = Jn(t2[e4], t2, n2);
  return { type: "ArrowFunctionExpression", start: s2, end: i2, async: o2, expression: a2, generator: l2, ...c2.length > 0 ? { [Gn]: c2 } : {}, params: u2, body: d2, id: null };
}, function(e4, t2, n2) {
  return { type: "AssignmentExpression", start: t2[e4++], end: t2[e4++], operator: Un[t2[e4++]], left: Jn(t2[e4++], t2, n2), right: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "AssignmentPattern", start: t2[e4++], end: t2[e4++], left: Jn(t2[e4++], t2, n2), right: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "AwaitExpression", start: t2[e4++], end: t2[e4++], argument: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "BinaryExpression", start: t2[e4++], end: t2[e4++], operator: Un[t2[e4++]], left: Jn(t2[e4++], t2, n2), right: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "BlockStatement", start: t2[e4++], end: t2[e4++], body: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4];
  return { type: "BreakStatement", start: s2, end: i2, label: 0 === r2 ? null : Jn(r2, t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = !(1 & ~t2[e4++]), o2 = qn(t2[e4++], t2), a2 = Jn(t2[e4++], t2, n2), l2 = Xn(t2[e4], t2, n2);
  return { type: "CallExpression", start: s2, end: i2, optional: r2, ...o2.length > 0 ? { [Gn]: o2 } : {}, callee: a2, arguments: l2 };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++];
  return { type: "CatchClause", start: s2, end: i2, param: 0 === r2 ? null : Jn(r2, t2, n2), body: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ChainExpression", start: t2[e4++], end: t2[e4++], expression: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ClassBody", start: t2[e4++], end: t2[e4++], body: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = 0 === r2 ? null : Jn(r2, t2, n2), a2 = t2[e4++];
  return { type: "ClassDeclaration", start: s2, end: i2, id: o2, superClass: 0 === a2 ? null : Jn(a2, t2, n2), body: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = 0 === r2 ? null : Jn(r2, t2, n2), a2 = t2[e4++];
  return { type: "ClassExpression", start: s2, end: i2, id: o2, superClass: 0 === a2 ? null : Jn(a2, t2, n2), body: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ConditionalExpression", start: t2[e4++], end: t2[e4++], test: Jn(t2[e4++], t2, n2), consequent: Jn(t2[e4++], t2, n2), alternate: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4];
  return { type: "ContinueStatement", start: s2, end: i2, label: 0 === r2 ? null : Jn(r2, t2, n2) };
}, function(e4, t2) {
  return { type: "DebuggerStatement", start: t2[e4++], end: t2[e4++] };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Kn(t2[e4++], t2, n2);
  return { type: "ExpressionStatement", start: s2, end: i2, directive: r2, expression: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "DoWhileStatement", start: t2[e4++], end: t2[e4++], body: Jn(t2[e4++], t2, n2), test: Jn(t2[e4], t2, n2) };
}, function(e4, t2) {
  return { type: "EmptyStatement", start: t2[e4++], end: t2[e4++] };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++];
  return { type: "ExportAllDeclaration", start: s2, end: i2, exported: 0 === r2 ? null : Jn(r2, t2, n2), source: Jn(t2[e4++], t2, n2), attributes: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ExportDefaultDeclaration", start: t2[e4++], end: t2[e4++], declaration: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Xn(t2[e4++], t2, n2), o2 = t2[e4++], a2 = 0 === o2 ? null : Jn(o2, t2, n2), l2 = Xn(t2[e4++], t2, n2), c2 = t2[e4];
  return { type: "ExportNamedDeclaration", start: s2, end: i2, specifiers: r2, source: a2, attributes: l2, declaration: 0 === c2 ? null : Jn(c2, t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Jn(t2[e4++], t2, n2), o2 = t2[e4];
  return { type: "ExportSpecifier", start: s2, end: i2, local: r2, exported: 0 === o2 ? { ...r2 } : Jn(o2, t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ExpressionStatement", start: t2[e4++], end: t2[e4++], expression: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ForInStatement", start: t2[e4++], end: t2[e4++], left: Jn(t2[e4++], t2, n2), right: Jn(t2[e4++], t2, n2), body: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ForOfStatement", start: t2[e4++], end: t2[e4++], await: !(1 & ~t2[e4++]), left: Jn(t2[e4++], t2, n2), right: Jn(t2[e4++], t2, n2), body: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = 0 === r2 ? null : Jn(r2, t2, n2), a2 = t2[e4++], l2 = 0 === a2 ? null : Jn(a2, t2, n2), c2 = t2[e4++];
  return { type: "ForStatement", start: s2, end: i2, init: o2, test: l2, update: 0 === c2 ? null : Jn(c2, t2, n2), body: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = !(1 & ~r2), a2 = !(2 & ~r2), l2 = qn(t2[e4++], t2), c2 = t2[e4++], u2 = 0 === c2 ? null : Jn(c2, t2, n2), d2 = Xn(t2[e4++], t2, n2), h2 = Jn(t2[e4], t2, n2);
  return { type: "FunctionDeclaration", start: s2, end: i2, async: o2, generator: a2, ...l2.length > 0 ? { [Gn]: l2 } : {}, id: u2, params: d2, body: h2, expression: false };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = !(1 & ~r2), a2 = !(2 & ~r2), l2 = qn(t2[e4++], t2), c2 = t2[e4++], u2 = 0 === c2 ? null : Jn(c2, t2, n2), d2 = Xn(t2[e4++], t2, n2), h2 = Jn(t2[e4], t2, n2);
  return { type: "FunctionExpression", start: s2, end: i2, async: o2, generator: a2, ...l2.length > 0 ? { [Gn]: l2 } : {}, id: u2, params: d2, body: h2, expression: false };
}, function(e4, t2, n2) {
  return { type: "Identifier", start: t2[e4++], end: t2[e4++], name: Kn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Jn(t2[e4++], t2, n2), o2 = Jn(t2[e4++], t2, n2), a2 = t2[e4];
  return { type: "IfStatement", start: s2, end: i2, test: r2, consequent: o2, alternate: 0 === a2 ? null : Jn(a2, t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ImportAttribute", start: t2[e4++], end: t2[e4++], key: Jn(t2[e4++], t2, n2), value: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ImportDeclaration", start: t2[e4++], end: t2[e4++], specifiers: Xn(t2[e4++], t2, n2), source: Jn(t2[e4++], t2, n2), attributes: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ImportDefaultSpecifier", start: t2[e4++], end: t2[e4++], local: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Jn(t2[e4++], t2, n2), o2 = t2[e4];
  return { type: "ImportExpression", start: s2, end: i2, source: r2, options: 0 === o2 ? null : Jn(o2, t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ImportNamespaceSpecifier", start: t2[e4++], end: t2[e4++], local: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = Jn(t2[e4], t2, n2);
  return { type: "ImportSpecifier", start: s2, end: i2, imported: 0 === r2 ? { ...o2 } : Jn(r2, t2, n2), local: o2 };
}, function(e4, t2, n2) {
  return { type: "LabeledStatement", start: t2[e4++], end: t2[e4++], label: Jn(t2[e4++], t2, n2), body: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Kn(t2[e4++], t2, n2);
  return { type: "Literal", start: s2, end: i2, bigint: r2, raw: Kn(t2[e4], t2, n2), value: BigInt(r2) };
}, function(e4, t2) {
  const n2 = t2[e4++], s2 = t2[e4++], i2 = !(1 & ~t2[e4++]);
  return { type: "Literal", start: n2, end: s2, value: i2, raw: i2 ? "true" : "false" };
}, function(e4, t2) {
  return { type: "Literal", start: t2[e4++], end: t2[e4++], raw: "null", value: null };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++];
  return { type: "Literal", start: s2, end: i2, raw: 0 === r2 ? void 0 : Kn(r2, t2, n2), value: new DataView(t2.buffer).getFloat64(e4 << 2, true) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Kn(t2[e4++], t2, n2), o2 = Kn(t2[e4], t2, n2);
  return { type: "Literal", start: s2, end: i2, raw: `/${o2}/${r2}`, regex: { flags: r2, pattern: o2 }, value: new RegExp(o2, r2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Kn(t2[e4++], t2, n2), o2 = t2[e4];
  return { type: "Literal", start: s2, end: i2, value: r2, raw: 0 === o2 ? void 0 : Kn(o2, t2, n2) };
}, function(e4, t2, n2) {
  return { type: "LogicalExpression", start: t2[e4++], end: t2[e4++], operator: Un[t2[e4++]], left: Jn(t2[e4++], t2, n2), right: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++];
  return { type: "MemberExpression", start: s2, end: i2, computed: !(1 & ~r2), optional: !(2 & ~r2), object: Jn(t2[e4++], t2, n2), property: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "MetaProperty", start: t2[e4++], end: t2[e4++], meta: Jn(t2[e4++], t2, n2), property: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++];
  return { type: "MethodDefinition", start: s2, end: i2, static: !(1 & ~r2), computed: !(2 & ~r2), key: Jn(t2[e4++], t2, n2), value: Jn(t2[e4++], t2, n2), kind: Un[t2[e4]] };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = qn(t2[e4++], t2), o2 = Jn(t2[e4++], t2, n2), a2 = Xn(t2[e4], t2, n2);
  return { type: "NewExpression", start: s2, end: i2, ...r2.length > 0 ? { [Gn]: r2 } : {}, callee: o2, arguments: a2 };
}, function(e4, t2, n2) {
  return { type: "ObjectExpression", start: t2[e4++], end: t2[e4++], properties: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "ObjectPattern", start: t2[e4++], end: t2[e4++], properties: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "PrivateIdentifier", start: t2[e4++], end: t2[e4++], name: Kn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Xn(t2[e4++], t2, n2), o2 = qn(t2[e4], t2);
  return { type: "Program", start: s2, end: i2, body: r2, ...o2.length > 0 ? { [Wn]: o2 } : {}, sourceType: "module" };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = !(1 & ~r2), a2 = !(2 & ~r2), l2 = !(4 & ~r2), c2 = t2[e4++], u2 = Jn(t2[e4++], t2, n2), d2 = Un[t2[e4]];
  return { type: "Property", start: s2, end: i2, method: o2, shorthand: a2, computed: l2, key: 0 === c2 ? { ...u2 } : Jn(c2, t2, n2), value: u2, kind: d2 };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++], o2 = !(1 & ~r2), a2 = !(2 & ~r2), l2 = Jn(t2[e4++], t2, n2), c2 = t2[e4];
  return { type: "PropertyDefinition", start: s2, end: i2, static: o2, computed: a2, key: l2, value: 0 === c2 ? null : Jn(c2, t2, n2) };
}, function(e4, t2, n2) {
  return { type: "RestElement", start: t2[e4++], end: t2[e4++], argument: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4];
  return { type: "ReturnStatement", start: s2, end: i2, argument: 0 === r2 ? null : Jn(r2, t2, n2) };
}, function(e4, t2, n2) {
  return { type: "SequenceExpression", start: t2[e4++], end: t2[e4++], expressions: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "SpreadElement", start: t2[e4++], end: t2[e4++], argument: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "StaticBlock", start: t2[e4++], end: t2[e4++], body: Xn(t2[e4], t2, n2) };
}, function(e4, t2) {
  return { type: "Super", start: t2[e4++], end: t2[e4++] };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = t2[e4++];
  return { type: "SwitchCase", start: s2, end: i2, test: 0 === r2 ? null : Jn(r2, t2, n2), consequent: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "SwitchStatement", start: t2[e4++], end: t2[e4++], discriminant: Jn(t2[e4++], t2, n2), cases: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "TaggedTemplateExpression", start: t2[e4++], end: t2[e4++], tag: Jn(t2[e4++], t2, n2), quasi: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = !(1 & ~t2[e4++]), o2 = t2[e4++];
  return { type: "TemplateElement", start: s2, end: i2, tail: r2, value: { cooked: 0 === o2 ? void 0 : Kn(o2, t2, n2), raw: Kn(t2[e4], t2, n2) } };
}, function(e4, t2, n2) {
  return { type: "TemplateLiteral", start: t2[e4++], end: t2[e4++], quasis: Xn(t2[e4++], t2, n2), expressions: Xn(t2[e4], t2, n2) };
}, function(e4, t2) {
  return { type: "ThisExpression", start: t2[e4++], end: t2[e4++] };
}, function(e4, t2, n2) {
  return { type: "ThrowStatement", start: t2[e4++], end: t2[e4++], argument: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Jn(t2[e4++], t2, n2), o2 = t2[e4++], a2 = 0 === o2 ? null : Jn(o2, t2, n2), l2 = t2[e4];
  return { type: "TryStatement", start: s2, end: i2, block: r2, handler: a2, finalizer: 0 === l2 ? null : Jn(l2, t2, n2) };
}, function(e4, t2, n2) {
  return { type: "UnaryExpression", start: t2[e4++], end: t2[e4++], operator: Un[t2[e4++]], argument: Jn(t2[e4], t2, n2), prefix: true };
}, function(e4, t2, n2) {
  return { type: "UpdateExpression", start: t2[e4++], end: t2[e4++], prefix: !(1 & ~t2[e4++]), operator: Un[t2[e4++]], argument: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  return { type: "VariableDeclaration", start: t2[e4++], end: t2[e4++], kind: Un[t2[e4++]], declarations: Xn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = Jn(t2[e4++], t2, n2), o2 = t2[e4];
  return { type: "VariableDeclarator", start: s2, end: i2, id: r2, init: 0 === o2 ? null : Jn(o2, t2, n2) };
}, function(e4, t2, n2) {
  return { type: "WhileStatement", start: t2[e4++], end: t2[e4++], test: Jn(t2[e4++], t2, n2), body: Jn(t2[e4], t2, n2) };
}, function(e4, t2, n2) {
  const s2 = t2[e4++], i2 = t2[e4++], r2 = !(1 & ~t2[e4++]), o2 = t2[e4];
  return { type: "YieldExpression", start: s2, end: i2, delegate: r2, argument: 0 === o2 ? null : Jn(o2, t2, n2) };
}];
function Jn(e4, t2, n2) {
  const s2 = t2[e4], i2 = Yn[s2];
  if (!i2)
    throw console.trace(), new Error(`Unknown node type: ${s2}`);
  return i2(e4 + 1, t2, n2);
}
function Xn(e4, t2, n2) {
  if (0 === e4)
    return we;
  const s2 = t2[e4++], i2 = [];
  for (let r2 = 0; r2 < s2; r2++) {
    const s3 = t2[e4++];
    i2.push(s3 ? Jn(s3, t2, n2) : null);
  }
  return i2;
}
function Zn(e4) {
  if ("undefined" != typeof Buffer && e4 instanceof Buffer)
    return function(t2, n2) {
      return e4.toString("utf8", t2, t2 + n2);
    };
  {
    const t2 = new TextDecoder();
    return function(n2, s2) {
      return t2.decode(e4.subarray(n2, n2 + s2));
    };
  }
}
function Qn(e4, t2 = null) {
  return Object.create(t2, e4);
}
const es = new class extends ae {
  getLiteralValueAtPath() {
  }
}(), ts = { value: { hasEffectsWhenCalled: null, returns: le } }, ns = new class extends ae {
  getReturnExpressionWhenCalledAtPath(e4) {
    return 1 === e4.length ? ms(us, e4[0]) : ce;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return 0 === t2.type ? e4.length > 1 : 2 !== t2.type || 1 !== e4.length || fs(us, e4[0], t2, n2);
  }
}(), ss = { value: { hasEffectsWhenCalled: null, returns: ns } }, is = new class extends ae {
  getReturnExpressionWhenCalledAtPath(e4) {
    return 1 === e4.length ? ms(ds, e4[0]) : ce;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return 0 === t2.type ? e4.length > 1 : 2 !== t2.type || 1 !== e4.length || fs(ds, e4[0], t2, n2);
  }
}(), rs = { value: { hasEffectsWhenCalled: null, returns: is } }, os = new class extends ae {
  getReturnExpressionWhenCalledAtPath(e4) {
    return 1 === e4.length ? ms(ps, e4[0]) : ce;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return 0 === t2.type ? e4.length > 1 : 2 !== t2.type || 1 !== e4.length || fs(ps, e4[0], t2, n2);
  }
}(), as = { value: { hasEffectsWhenCalled: null, returns: os } }, ls = { value: { hasEffectsWhenCalled({ args: e4 }, t2) {
  const n2 = e4[2];
  return e4.length < 3 || "symbol" == typeof n2.getLiteralValueAtPath(Y, te, { deoptimizeCache() {
  } }) && n2.hasEffectsOnInteractionAtPath(Y, pe, t2);
}, returns: os } }, cs = Qn({ hasOwnProperty: ss, isPrototypeOf: ss, propertyIsEnumerable: ss, toLocaleString: as, toString: as, valueOf: ts }), us = Qn({ valueOf: ss }, cs), ds = Qn({ toExponential: as, toFixed: as, toLocaleString: as, toPrecision: as, valueOf: rs }, cs), hs = Qn({ exec: ts, test: ss }, cs), ps = Qn({ anchor: as, at: ts, big: as, blink: as, bold: as, charAt: as, charCodeAt: rs, codePointAt: ts, concat: as, endsWith: ss, fixed: as, fontcolor: as, fontsize: as, includes: ss, indexOf: rs, italics: as, lastIndexOf: rs, link: as, localeCompare: rs, match: ts, matchAll: ts, normalize: as, padEnd: as, padStart: as, repeat: as, replace: ls, replaceAll: ls, search: rs, slice: as, small: as, split: ts, startsWith: ss, strike: as, sub: as, substr: as, substring: as, sup: as, toLocaleLowerCase: as, toLocaleUpperCase: as, toLowerCase: as, toString: as, toUpperCase: as, trim: as, trimEnd: as, trimLeft: as, trimRight: as, trimStart: as, valueOf: as }, cs);
function fs(e4, t2, n2, s2) {
  var _a3, _b;
  return "string" != typeof t2 || !e4[t2] || (((_b = (_a3 = e4[t2]).hasEffectsWhenCalled) == null ? void 0 : _b.call(_a3, n2, s2)) || false);
}
function ms(e4, t2) {
  return "string" == typeof t2 && e4[t2] ? [e4[t2].returns, false] : ce;
}
const gs = { ArrayExpression: ["elements"], ArrayPattern: ["elements"], ArrowFunctionExpression: ["params", "body"], AssignmentExpression: ["left", "right"], AssignmentPattern: ["left", "right"], AwaitExpression: ["argument"], BinaryExpression: ["left", "right"], BlockStatement: ["body"], BreakStatement: ["label"], CallExpression: ["callee", "arguments"], CatchClause: ["param", "body"], ChainExpression: ["expression"], ClassBody: ["body"], ClassDeclaration: ["id", "superClass", "body"], ClassExpression: ["id", "superClass", "body"], ConditionalExpression: ["test", "consequent", "alternate"], ContinueStatement: ["label"], DebuggerStatement: [], DoWhileStatement: ["body", "test"], EmptyStatement: [], ExportAllDeclaration: ["exported", "source", "attributes"], ExportDefaultDeclaration: ["declaration"], ExportNamedDeclaration: ["specifiers", "source", "attributes", "declaration"], ExportSpecifier: ["local", "exported"], ExpressionStatement: ["expression"], ForInStatement: ["left", "right", "body"], ForOfStatement: ["left", "right", "body"], ForStatement: ["init", "test", "update", "body"], FunctionDeclaration: ["id", "params", "body"], FunctionExpression: ["id", "params", "body"], Identifier: [], IfStatement: ["test", "consequent", "alternate"], ImportAttribute: ["key", "value"], ImportDeclaration: ["specifiers", "source", "attributes"], ImportDefaultSpecifier: ["local"], ImportExpression: ["source", "options"], ImportNamespaceSpecifier: ["local"], ImportSpecifier: ["imported", "local"], LabeledStatement: ["label", "body"], Literal: [], LogicalExpression: ["left", "right"], MemberExpression: ["object", "property"], MetaProperty: ["meta", "property"], MethodDefinition: ["key", "value"], NewExpression: ["callee", "arguments"], ObjectExpression: ["properties"], ObjectPattern: ["properties"], PanicError: [], ParseError: [], PrivateIdentifier: [], Program: ["body"], Property: ["key", "value"], PropertyDefinition: ["key", "value"], RestElement: ["argument"], ReturnStatement: ["argument"], SequenceExpression: ["expressions"], SpreadElement: ["argument"], StaticBlock: ["body"], Super: [], SwitchCase: ["test", "consequent"], SwitchStatement: ["discriminant", "cases"], TaggedTemplateExpression: ["tag", "quasi"], TemplateElement: [], TemplateLiteral: ["quasis", "expressions"], ThisExpression: [], ThrowStatement: ["argument"], TryStatement: ["block", "handler", "finalizer"], UnaryExpression: ["argument"], UpdateExpression: ["argument"], VariableDeclaration: ["declarations"], VariableDeclarator: ["id", "init"], WhileStatement: ["test", "body"], YieldExpression: ["argument"] }, ys = "variables";
class bs extends ae {
  get deoptimized() {
    return se(this.flags, 2);
  }
  set deoptimized(e4) {
    this.flags = ie(this.flags, 2, e4);
  }
  constructor(e4, t2) {
    super(), this.parent = e4, this.scope = t2, this.createScope(t2);
  }
  addExportedVariables(e4, t2) {
  }
  bind() {
    for (const e4 of gs[this.type]) {
      const t2 = this[e4];
      if (Array.isArray(t2))
        for (const e5 of t2)
          e5 == null ? void 0 : e5.bind();
      else
        t2 && t2.bind();
    }
  }
  createScope(e4) {
    this.scope = e4;
  }
  hasEffects(e4) {
    this.deoptimized || this.applyDeoptimizations();
    for (const t2 of gs[this.type]) {
      const n2 = this[t2];
      if (null !== n2) {
        if (Array.isArray(n2)) {
          for (const t3 of n2)
            if (t3 == null ? void 0 : t3.hasEffects(e4))
              return true;
        } else if (n2.hasEffects(e4))
          return true;
      }
    }
    return false;
  }
  hasEffectsAsAssignmentTarget(e4, t2) {
    return this.hasEffects(e4) || this.hasEffectsOnInteractionAtPath(Y, this.assignmentInteraction, e4);
  }
  include(e4, t2, n2) {
    this.deoptimized || this.applyDeoptimizations(), this.included = true;
    for (const n3 of gs[this.type]) {
      const s2 = this[n3];
      if (null !== s2)
        if (Array.isArray(s2))
          for (const n4 of s2)
            n4 == null ? void 0 : n4.include(e4, t2);
        else
          s2.include(e4, t2);
    }
  }
  includeAsAssignmentTarget(e4, t2, n2) {
    this.include(e4, t2);
  }
  initialise() {
    this.scope.context.magicString.addSourcemapLocation(this.start), this.scope.context.magicString.addSourcemapLocation(this.end);
  }
  parseNode(e4) {
    var _a3;
    for (const [t2, n2] of Object.entries(e4))
      if (!this.hasOwnProperty(t2))
        if (95 === t2.charCodeAt(0))
          t2 === Gn ? this.annotations = n2 : t2 === Wn && (this.invalidAnnotations = n2);
        else if ("object" != typeof n2 || null === n2)
          this[t2] = n2;
        else if (Array.isArray(n2)) {
          this[t2] = [];
          for (const e5 of n2)
            this[t2].push(null === e5 ? null : new (this.scope.context.getNodeConstructor(e5.type))(this, this.scope).parseNode(e5));
        } else
          this[t2] = new (this.scope.context.getNodeConstructor(n2.type))(this, this.scope).parseNode(n2);
    return gs[_a3 = e4.type] || (gs[_a3] = function(e5) {
      return Object.keys(e5).filter((t2) => "object" == typeof e5[t2] && 95 !== t2.charCodeAt(0));
    }(e4)), this.initialise(), this;
  }
  removeAnnotations(e4) {
    if (this.annotations)
      for (const t2 of this.annotations)
        e4.remove(t2.start, t2.end);
  }
  render(e4, t2) {
    for (const n2 of gs[this.type]) {
      const s2 = this[n2];
      if (null !== s2)
        if (Array.isArray(s2))
          for (const n3 of s2)
            n3 == null ? void 0 : n3.render(e4, t2);
        else
          s2.render(e4, t2);
    }
  }
  setAssignedValue(e4) {
    this.assignmentInteraction = { args: [null, e4], type: 1 };
  }
  shouldBeIncluded(e4) {
    return this.included || !e4.brokenFlow && this.hasEffects(jn());
  }
  applyDeoptimizations() {
    this.deoptimized = true;
    for (const e4 of gs[this.type]) {
      const t2 = this[e4];
      if (null !== t2)
        if (Array.isArray(t2))
          for (const e5 of t2)
            e5 == null ? void 0 : e5.deoptimizePath(J);
        else
          t2.deoptimizePath(J);
    }
    this.scope.context.requestTreeshakingPass();
  }
}
class Es extends bs {
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    t2.length > 0 && this.argument.deoptimizeArgumentsOnInteractionAtPath(e4, [W, ...t2], n2);
  }
  hasEffects(e4) {
    this.deoptimized || this.applyDeoptimizations();
    const { propertyReadSideEffects: t2 } = this.scope.context.options.treeshake;
    return this.argument.hasEffects(e4) || t2 && ("always" === t2 || this.argument.hasEffectsOnInteractionAtPath(J, de, e4));
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.argument.deoptimizePath([W, W]), this.scope.context.requestTreeshakingPass();
  }
}
class xs extends ae {
  constructor(e4) {
    super(), this.description = e4;
  }
  deoptimizeArgumentsOnInteractionAtPath({ args: e4, type: t2 }, n2) {
    var _a3;
    if (2 === t2 && 0 === n2.length && (this.description.mutatesSelfAsArray && ((_a3 = e4[0]) == null ? void 0 : _a3.deoptimizePath(Z)), this.description.mutatesArgs))
      for (let t3 = 1; t3 < e4.length; t3++)
        e4[t3].deoptimizePath(J);
  }
  getReturnExpressionWhenCalledAtPath(e4, { args: t2 }) {
    return e4.length > 0 ? ce : [this.description.returnsPrimitive || ("self" === this.description.returns ? t2[0] || le : this.description.returns()), false];
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    var _a3, _b;
    const { type: s2 } = t2;
    if (e4.length > (0 === s2 ? 1 : 0))
      return true;
    if (2 === s2) {
      const { args: e5 } = t2;
      if (true === this.description.mutatesSelfAsArray && ((_a3 = e5[0]) == null ? void 0 : _a3.hasEffectsOnInteractionAtPath(Z, he, n2)))
        return true;
      if (this.description.callsArgs) {
        for (const t3 of this.description.callsArgs)
          if ((_b = e5[t3 + 1]) == null ? void 0 : _b.hasEffectsOnInteractionAtPath(Y, pe, n2))
            return true;
      }
    }
    return false;
  }
}
const $s = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: false, returns: null, returnsPrimitive: ns })], As = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: false, returns: null, returnsPrimitive: os })], Ss = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: false, returns: null, returnsPrimitive: is })], ws = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: false, returns: null, returnsPrimitive: le })], vs = /^\d+$/;
class Ps extends ae {
  get hasLostTrack() {
    return se(this.flags, 2048);
  }
  set hasLostTrack(e4) {
    this.flags = ie(this.flags, 2048, e4);
  }
  get hasUnknownDeoptimizedInteger() {
    return se(this.flags, 4096);
  }
  set hasUnknownDeoptimizedInteger(e4) {
    this.flags = ie(this.flags, 4096, e4);
  }
  get hasUnknownDeoptimizedProperty() {
    return se(this.flags, 8192);
  }
  set hasUnknownDeoptimizedProperty(e4) {
    this.flags = ie(this.flags, 8192, e4);
  }
  constructor(e4, t2, n2 = false) {
    if (super(), this.prototypeExpression = t2, this.immutable = n2, this.additionalExpressionsToBeDeoptimized = /* @__PURE__ */ new Set(), this.allProperties = [], this.deoptimizedPaths = /* @__PURE__ */ Object.create(null), this.expressionsToBeDeoptimizedByKey = /* @__PURE__ */ Object.create(null), this.gettersByKey = /* @__PURE__ */ Object.create(null), this.propertiesAndGettersByKey = /* @__PURE__ */ Object.create(null), this.propertiesAndSettersByKey = /* @__PURE__ */ Object.create(null), this.settersByKey = /* @__PURE__ */ Object.create(null), this.unknownIntegerProps = [], this.unmatchableGetters = [], this.unmatchablePropertiesAndGetters = [], this.unmatchableSetters = [], Array.isArray(e4))
      this.buildPropertyMaps(e4);
    else {
      this.propertiesAndGettersByKey = this.propertiesAndSettersByKey = e4;
      for (const t3 of Object.values(e4))
        this.allProperties.push(...t3);
    }
  }
  deoptimizeAllProperties(e4) {
    var _a3;
    const t2 = this.hasLostTrack || this.hasUnknownDeoptimizedProperty;
    if (e4 ? this.hasUnknownDeoptimizedProperty = true : this.hasLostTrack = true, !t2) {
      for (const e5 of [...Object.values(this.propertiesAndGettersByKey), ...Object.values(this.settersByKey)])
        for (const t3 of e5)
          t3.deoptimizePath(J);
      (_a3 = this.prototypeExpression) == null ? void 0 : _a3.deoptimizePath([W, W]), this.deoptimizeCachedEntities();
    }
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    var _a3;
    const [s2, ...i2] = t2, { args: r2, type: o2 } = e4;
    if (this.hasLostTrack || (2 === o2 || t2.length > 1) && (this.hasUnknownDeoptimizedProperty || "string" == typeof s2 && this.deoptimizedPaths[s2]))
      return void ue(e4);
    const [a2, l2, c2] = 2 === o2 || t2.length > 1 ? [this.propertiesAndGettersByKey, this.propertiesAndGettersByKey, this.unmatchablePropertiesAndGetters] : 0 === o2 ? [this.propertiesAndGettersByKey, this.gettersByKey, this.unmatchableGetters] : [this.propertiesAndSettersByKey, this.settersByKey, this.unmatchableSetters];
    if ("string" == typeof s2) {
      if (a2[s2]) {
        const t3 = l2[s2];
        if (t3)
          for (const s3 of t3)
            s3.deoptimizeArgumentsOnInteractionAtPath(e4, i2, n2);
        if (!this.immutable)
          for (const e5 of r2)
            e5 && this.additionalExpressionsToBeDeoptimized.add(e5);
        return;
      }
      for (const t3 of c2)
        t3.deoptimizeArgumentsOnInteractionAtPath(e4, i2, n2);
      if (vs.test(s2))
        for (const t3 of this.unknownIntegerProps)
          t3.deoptimizeArgumentsOnInteractionAtPath(e4, i2, n2);
    } else {
      for (const t3 of [...Object.values(l2), c2])
        for (const s3 of t3)
          s3.deoptimizeArgumentsOnInteractionAtPath(e4, i2, n2);
      for (const t3 of this.unknownIntegerProps)
        t3.deoptimizeArgumentsOnInteractionAtPath(e4, i2, n2);
    }
    if (!this.immutable)
      for (const e5 of r2)
        e5 && this.additionalExpressionsToBeDeoptimized.add(e5);
    (_a3 = this.prototypeExpression) == null ? void 0 : _a3.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizeIntegerProperties() {
    if (!(this.hasLostTrack || this.hasUnknownDeoptimizedProperty || this.hasUnknownDeoptimizedInteger)) {
      this.hasUnknownDeoptimizedInteger = true;
      for (const [e4, t2] of Object.entries(this.propertiesAndGettersByKey))
        if (vs.test(e4))
          for (const e5 of t2)
            e5.deoptimizePath(J);
      this.deoptimizeCachedIntegerEntities();
    }
  }
  deoptimizePath(e4) {
    var _a3;
    if (this.hasLostTrack || this.immutable)
      return;
    const t2 = e4[0];
    if (1 === e4.length) {
      if ("string" != typeof t2)
        return t2 === H ? this.deoptimizeIntegerProperties() : this.deoptimizeAllProperties(t2 === q);
      if (!this.deoptimizedPaths[t2]) {
        this.deoptimizedPaths[t2] = true;
        const e5 = this.expressionsToBeDeoptimizedByKey[t2];
        if (e5)
          for (const t3 of e5)
            t3.deoptimizeCache();
      }
    }
    const n2 = 1 === e4.length ? J : e4.slice(1);
    for (const e5 of "string" == typeof t2 ? [...this.propertiesAndGettersByKey[t2] || this.unmatchablePropertiesAndGetters, ...this.settersByKey[t2] || this.unmatchableSetters] : this.allProperties)
      e5.deoptimizePath(n2);
    (_a3 = this.prototypeExpression) == null ? void 0 : _a3.deoptimizePath(1 === e4.length ? [...e4, W] : e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    if (0 === e4.length)
      return oe;
    const s2 = e4[0], i2 = this.getMemberExpressionAndTrackDeopt(s2, n2);
    return i2 ? i2.getLiteralValueAtPath(e4.slice(1), t2, n2) : this.prototypeExpression ? this.prototypeExpression.getLiteralValueAtPath(e4, t2, n2) : 1 !== e4.length ? re : void 0;
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    if (0 === e4.length)
      return ce;
    const [i2, ...r2] = e4, o2 = this.getMemberExpressionAndTrackDeopt(i2, s2);
    return o2 ? o2.getReturnExpressionWhenCalledAtPath(r2, t2, n2, s2) : this.prototypeExpression ? this.prototypeExpression.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) : ce;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    const [s2, ...i2] = e4;
    if (i2.length > 0 || 2 === t2.type) {
      const r3 = this.getMemberExpression(s2);
      return r3 ? r3.hasEffectsOnInteractionAtPath(i2, t2, n2) : !this.prototypeExpression || this.prototypeExpression.hasEffectsOnInteractionAtPath(e4, t2, n2);
    }
    if (s2 === q)
      return false;
    if (this.hasLostTrack)
      return true;
    const [r2, o2, a2] = 0 === t2.type ? [this.propertiesAndGettersByKey, this.gettersByKey, this.unmatchableGetters] : [this.propertiesAndSettersByKey, this.settersByKey, this.unmatchableSetters];
    if ("string" == typeof s2) {
      if (r2[s2]) {
        const e5 = o2[s2];
        if (e5) {
          for (const s3 of e5)
            if (s3.hasEffectsOnInteractionAtPath(i2, t2, n2))
              return true;
        }
        return false;
      }
      for (const e5 of a2)
        if (e5.hasEffectsOnInteractionAtPath(i2, t2, n2))
          return true;
    } else
      for (const e5 of [...Object.values(o2), a2])
        for (const s3 of e5)
          if (s3.hasEffectsOnInteractionAtPath(i2, t2, n2))
            return true;
    return !!this.prototypeExpression && this.prototypeExpression.hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  buildPropertyMaps(e4) {
    const { allProperties: t2, propertiesAndGettersByKey: n2, propertiesAndSettersByKey: s2, settersByKey: i2, gettersByKey: r2, unknownIntegerProps: o2, unmatchablePropertiesAndGetters: a2, unmatchableGetters: l2, unmatchableSetters: c2 } = this, u2 = [];
    for (let d2 = e4.length - 1; d2 >= 0; d2--) {
      const { key: h2, kind: p2, property: f2 } = e4[d2];
      if (t2.push(f2), "string" == typeof h2)
        "set" === p2 ? s2[h2] || (s2[h2] = [f2, ...u2], i2[h2] = [f2, ...c2]) : "get" === p2 ? n2[h2] || (n2[h2] = [f2, ...a2], r2[h2] = [f2, ...l2]) : (s2[h2] || (s2[h2] = [f2, ...u2]), n2[h2] || (n2[h2] = [f2, ...a2]));
      else {
        if (h2 === H) {
          o2.push(f2);
          continue;
        }
        "set" === p2 && c2.push(f2), "get" === p2 && l2.push(f2), "get" !== p2 && u2.push(f2), "set" !== p2 && a2.push(f2);
      }
    }
  }
  deoptimizeCachedEntities() {
    for (const e4 of Object.values(this.expressionsToBeDeoptimizedByKey))
      for (const t2 of e4)
        t2.deoptimizeCache();
    for (const e4 of this.additionalExpressionsToBeDeoptimized)
      e4.deoptimizePath(J);
  }
  deoptimizeCachedIntegerEntities() {
    for (const [e4, t2] of Object.entries(this.expressionsToBeDeoptimizedByKey))
      if (vs.test(e4))
        for (const e5 of t2)
          e5.deoptimizeCache();
    for (const e4 of this.additionalExpressionsToBeDeoptimized)
      e4.deoptimizePath(Z);
  }
  getMemberExpression(e4) {
    if (this.hasLostTrack || this.hasUnknownDeoptimizedProperty || "string" != typeof e4 || this.hasUnknownDeoptimizedInteger && vs.test(e4) || this.deoptimizedPaths[e4])
      return le;
    const t2 = this.propertiesAndGettersByKey[e4];
    return 1 === (t2 == null ? void 0 : t2.length) ? t2[0] : t2 || this.unmatchablePropertiesAndGetters.length > 0 || this.unknownIntegerProps.length > 0 && vs.test(e4) ? le : null;
  }
  getMemberExpressionAndTrackDeopt(e4, t2) {
    if ("string" != typeof e4)
      return le;
    const n2 = this.getMemberExpression(e4);
    if (n2 !== le && !this.immutable) {
      (this.expressionsToBeDeoptimizedByKey[e4] = this.expressionsToBeDeoptimizedByKey[e4] || []).push(t2);
    }
    return n2;
  }
}
const Is = (e4) => "string" == typeof e4 && /^\d+$/.test(e4), ks = new class extends ae {
  deoptimizeArgumentsOnInteractionAtPath(e4, t2) {
    2 !== e4.type || 1 !== t2.length || Is(t2[0]) || ue(e4);
  }
  getLiteralValueAtPath(e4) {
    return 1 === e4.length && Is(e4[0]) ? void 0 : re;
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }) {
    return e4.length > 1 || 2 === t2;
  }
}(), Ns = new Ps({ __proto__: null, hasOwnProperty: $s, isPrototypeOf: $s, propertyIsEnumerable: $s, toLocaleString: As, toString: As, valueOf: ws }, ks, true), Cs = [{ key: H, kind: "init", property: le }, { key: "length", kind: "init", property: is }], Os = [new xs({ callsArgs: [0], mutatesArgs: false, mutatesSelfAsArray: "deopt-only", returns: null, returnsPrimitive: ns })], Ds = [new xs({ callsArgs: [0], mutatesArgs: false, mutatesSelfAsArray: "deopt-only", returns: null, returnsPrimitive: is })], Ms = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: true, returns: () => new Ps(Cs, js), returnsPrimitive: null })], Rs = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: "deopt-only", returns: () => new Ps(Cs, js), returnsPrimitive: null })], _s = [new xs({ callsArgs: [0], mutatesArgs: false, mutatesSelfAsArray: "deopt-only", returns: () => new Ps(Cs, js), returnsPrimitive: null })], Ls = [new xs({ callsArgs: null, mutatesArgs: true, mutatesSelfAsArray: true, returns: null, returnsPrimitive: is })], Bs = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: true, returns: null, returnsPrimitive: le })], Ts = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: "deopt-only", returns: null, returnsPrimitive: le })], zs = [new xs({ callsArgs: [0], mutatesArgs: false, mutatesSelfAsArray: "deopt-only", returns: null, returnsPrimitive: le })], Vs = [new xs({ callsArgs: null, mutatesArgs: false, mutatesSelfAsArray: true, returns: "self", returnsPrimitive: null })], Fs = [new xs({ callsArgs: [0], mutatesArgs: false, mutatesSelfAsArray: true, returns: "self", returnsPrimitive: null })], js = new Ps({ __proto__: null, at: Ts, concat: Rs, copyWithin: Vs, entries: Rs, every: Os, fill: Vs, filter: _s, find: zs, findIndex: Ds, findLast: zs, findLastIndex: Ds, flat: Rs, flatMap: _s, forEach: zs, includes: $s, indexOf: Ss, join: As, keys: ws, lastIndexOf: Ss, map: _s, pop: Bs, push: Ls, reduce: zs, reduceRight: zs, reverse: Vs, shift: Bs, slice: Rs, some: Os, sort: Fs, splice: Ms, toLocaleString: As, toString: As, unshift: Ls, values: Ts }, Ns, true);
class Us extends bs {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.getObjectEntity().deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizePath(e4) {
    this.getObjectEntity().deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.getObjectEntity().getLiteralValueAtPath(e4, t2, n2);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return this.getObjectEntity().getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return this.getObjectEntity().hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  applyDeoptimizations() {
    this.deoptimized = true;
    let e4 = false;
    for (let t2 = 0; t2 < this.elements.length; t2++) {
      const n2 = this.elements[t2];
      n2 && (e4 || n2 instanceof Es) && (e4 = true, n2.deoptimizePath(J));
    }
    this.scope.context.requestTreeshakingPass();
  }
  getObjectEntity() {
    if (null !== this.objectEntity)
      return this.objectEntity;
    const e4 = [{ key: "length", kind: "init", property: is }];
    let t2 = false;
    for (let n2 = 0; n2 < this.elements.length; n2++) {
      const s2 = this.elements[n2];
      t2 || s2 instanceof Es ? s2 && (t2 = true, e4.unshift({ key: H, kind: "init", property: s2 })) : s2 ? e4.push({ key: String(n2), kind: "init", property: s2 }) : e4.push({ key: String(n2), kind: "init", property: es });
    }
    return this.objectEntity = new Ps(e4, js);
  }
}
class Gs extends bs {
  addExportedVariables(e4, t2) {
    for (const n2 of this.elements)
      n2 == null ? void 0 : n2.addExportedVariables(e4, t2);
  }
  declare(e4) {
    const t2 = [];
    for (const n2 of this.elements)
      null !== n2 && t2.push(...n2.declare(e4, le));
    return t2;
  }
  deoptimizePath() {
    for (const e4 of this.elements)
      e4 == null ? void 0 : e4.deoptimizePath(Y);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    for (const e5 of this.elements)
      if (e5 == null ? void 0 : e5.hasEffectsOnInteractionAtPath(Y, t2, n2))
        return true;
    return false;
  }
  markDeclarationReached() {
    for (const e4 of this.elements)
      e4 == null ? void 0 : e4.markDeclarationReached();
  }
}
function Ws(e4, t2) {
  if ("MemberExpression" === e4.type)
    return !e4.computed && Ws(e4.object, e4);
  if ("Identifier" === e4.type) {
    if (!t2)
      return true;
    switch (t2.type) {
      case "MemberExpression":
        return t2.computed || e4 === t2.object;
      case "MethodDefinition":
        return t2.computed;
      case "PropertyDefinition":
      case "Property":
        return t2.computed || e4 === t2.value;
      case "ExportSpecifier":
      case "ImportSpecifier":
        return e4 === t2.local;
      case "LabeledStatement":
      case "BreakStatement":
      case "ContinueStatement":
        return false;
      default:
        return true;
    }
  }
  return false;
}
const qs = Symbol("PureFunction"), Hs = () => {
}, Ks = Symbol("Value Properties"), Ys = () => oe, Js = () => false, Xs = () => true, Zs = { deoptimizeArgumentsOnCall: Hs, getLiteralValue: Ys, hasEffectsWhenCalled: Js }, Qs = { deoptimizeArgumentsOnCall: Hs, getLiteralValue: Ys, hasEffectsWhenCalled: Xs }, ei = { deoptimizeArgumentsOnCall: Hs, getLiteralValue: Ys, hasEffectsWhenCalled: ({ args: e4 }) => e4.length > 1 && !(e4[1] instanceof Us) }, ti = { deoptimizeArgumentsOnCall: Hs, getLiteralValue: Ys, hasEffectsWhenCalled({ args: e4 }, t2) {
  const [n2, s2] = e4;
  return !(s2 instanceof ae) || s2.hasEffectsOnInteractionAtPath(J, de, t2);
} }, ni = { __proto__: null, [Ks]: Qs }, si = { __proto__: null, [Ks]: Zs }, ii = { __proto__: null, [Ks]: ti }, ri = { __proto__: null, [Ks]: { deoptimizeArgumentsOnCall({ args: [, e4] }) {
  e4 == null ? void 0 : e4.deoptimizePath(J);
}, getLiteralValue: Ys, hasEffectsWhenCalled: ({ args: e4 }, t2) => e4.length <= 1 || e4[1].hasEffectsOnInteractionAtPath(X, he, t2) } }, oi = { __proto__: null, [Ks]: Qs, prototype: ni }, ai = { __proto__: null, [Ks]: Zs, prototype: ni }, li = { __proto__: null, [Ks]: ei, prototype: ni }, ci = { __proto__: null, [Ks]: Zs, from: ni, of: si, prototype: ni }, ui = { __proto__: null, [Ks]: Zs, supportedLocalesOf: ai }, di = { global: ni, globalThis: ni, self: ni, window: ni, __proto__: null, [Ks]: Qs, Array: { __proto__: null, [Ks]: Qs, from: ni, isArray: si, of: si, prototype: ni }, ArrayBuffer: { __proto__: null, [Ks]: Zs, isView: si, prototype: ni }, Atomics: ni, BigInt: oi, BigInt64Array: oi, BigUint64Array: oi, Boolean: ai, constructor: oi, DataView: ai, Date: { __proto__: null, [Ks]: Zs, now: si, parse: si, prototype: ni, UTC: si }, decodeURI: si, decodeURIComponent: si, encodeURI: si, encodeURIComponent: si, Error: ai, escape: si, eval: ni, EvalError: ai, Float32Array: ci, Float64Array: ci, Function: oi, hasOwnProperty: ni, Infinity: ni, Int16Array: ci, Int32Array: ci, Int8Array: ci, isFinite: si, isNaN: si, isPrototypeOf: ni, JSON: ni, Map: li, Math: { __proto__: null, [Ks]: Qs, abs: si, acos: si, acosh: si, asin: si, asinh: si, atan: si, atan2: si, atanh: si, cbrt: si, ceil: si, clz32: si, cos: si, cosh: si, exp: si, expm1: si, floor: si, fround: si, hypot: si, imul: si, log: si, log10: si, log1p: si, log2: si, max: si, min: si, pow: si, random: si, round: si, sign: si, sin: si, sinh: si, sqrt: si, tan: si, tanh: si, trunc: si }, NaN: ni, Number: { __proto__: null, [Ks]: Zs, isFinite: si, isInteger: si, isNaN: si, isSafeInteger: si, parseFloat: si, parseInt: si, prototype: ni }, Object: { __proto__: null, [Ks]: Zs, create: si, defineProperty: ri, defineProperties: ri, freeze: ri, getOwnPropertyDescriptor: si, getOwnPropertyDescriptors: si, getOwnPropertyNames: si, getOwnPropertySymbols: si, getPrototypeOf: si, hasOwn: si, is: si, isExtensible: si, isFrozen: si, isSealed: si, keys: si, fromEntries: ni, entries: ii, values: ii, prototype: ni }, parseFloat: si, parseInt: si, Promise: { __proto__: null, [Ks]: Qs, all: ni, allSettled: ni, any: ni, prototype: ni, race: ni, reject: ni, resolve: ni }, propertyIsEnumerable: ni, Proxy: ni, RangeError: ai, ReferenceError: ai, Reflect: ni, RegExp: ai, Set: li, SharedArrayBuffer: oi, String: { __proto__: null, [Ks]: Zs, fromCharCode: si, fromCodePoint: si, prototype: ni, raw: si }, Symbol: { __proto__: null, [Ks]: Zs, for: si, keyFor: si, prototype: ni, toStringTag: { __proto__: null, [Ks]: { deoptimizeArgumentsOnCall: Hs, getLiteralValue: () => K, hasEffectsWhenCalled: Xs } } }, SyntaxError: ai, toLocaleString: ni, toString: ni, TypeError: ai, Uint16Array: ci, Uint32Array: ci, Uint8Array: ci, Uint8ClampedArray: ci, unescape: si, URIError: ai, valueOf: ni, WeakMap: li, WeakSet: li, clearInterval: oi, clearTimeout: oi, console: { __proto__: null, [Ks]: Qs, assert: oi, clear: oi, count: oi, countReset: oi, debug: oi, dir: oi, dirxml: oi, error: oi, exception: oi, group: oi, groupCollapsed: oi, groupEnd: oi, info: oi, log: oi, table: oi, time: oi, timeEnd: oi, timeLog: oi, trace: oi, warn: oi }, Intl: { __proto__: null, [Ks]: Qs, Collator: ui, DateTimeFormat: ui, DisplayNames: ui, ListFormat: ui, Locale: ui, NumberFormat: ui, PluralRules: ui, RelativeTimeFormat: ui, Segmenter: ui }, setInterval: oi, setTimeout: oi, TextDecoder: oi, TextEncoder: oi, URL: { __proto__: null, [Ks]: Qs, prototype: ni, canParse: si }, URLSearchParams: oi, AbortController: oi, AbortSignal: oi, addEventListener: ni, alert: ni, AnalyserNode: oi, Animation: oi, AnimationEvent: oi, applicationCache: ni, ApplicationCache: oi, ApplicationCacheErrorEvent: oi, atob: ni, Attr: oi, Audio: oi, AudioBuffer: oi, AudioBufferSourceNode: oi, AudioContext: oi, AudioDestinationNode: oi, AudioListener: oi, AudioNode: oi, AudioParam: oi, AudioProcessingEvent: oi, AudioScheduledSourceNode: oi, AudioWorkletNode: oi, BarProp: oi, BaseAudioContext: oi, BatteryManager: oi, BeforeUnloadEvent: oi, BiquadFilterNode: oi, Blob: oi, BlobEvent: oi, blur: ni, BroadcastChannel: oi, btoa: ni, ByteLengthQueuingStrategy: oi, Cache: oi, caches: ni, CacheStorage: oi, cancelAnimationFrame: ni, cancelIdleCallback: ni, CanvasCaptureMediaStreamTrack: oi, CanvasGradient: oi, CanvasPattern: oi, CanvasRenderingContext2D: oi, ChannelMergerNode: oi, ChannelSplitterNode: oi, CharacterData: oi, clientInformation: ni, ClipboardEvent: oi, close: ni, closed: ni, CloseEvent: oi, Comment: oi, CompositionEvent: oi, confirm: ni, ConstantSourceNode: oi, ConvolverNode: oi, CountQueuingStrategy: oi, createImageBitmap: ni, Credential: oi, CredentialsContainer: oi, crypto: ni, Crypto: oi, CryptoKey: oi, CSS: oi, CSSConditionRule: oi, CSSFontFaceRule: oi, CSSGroupingRule: oi, CSSImportRule: oi, CSSKeyframeRule: oi, CSSKeyframesRule: oi, CSSMediaRule: oi, CSSNamespaceRule: oi, CSSPageRule: oi, CSSRule: oi, CSSRuleList: oi, CSSStyleDeclaration: oi, CSSStyleRule: oi, CSSStyleSheet: oi, CSSSupportsRule: oi, CustomElementRegistry: oi, customElements: ni, CustomEvent: { __proto__: null, [Ks]: { deoptimizeArgumentsOnCall({ args: e4 }) {
  var _a3;
  (_a3 = e4[2]) == null ? void 0 : _a3.deoptimizePath(["detail"]);
}, getLiteralValue: Ys, hasEffectsWhenCalled: Js }, prototype: ni }, DataTransfer: oi, DataTransferItem: oi, DataTransferItemList: oi, defaultstatus: ni, defaultStatus: ni, DelayNode: oi, DeviceMotionEvent: oi, DeviceOrientationEvent: oi, devicePixelRatio: ni, dispatchEvent: ni, document: ni, Document: oi, DocumentFragment: oi, DocumentType: oi, DOMError: oi, DOMException: oi, DOMImplementation: oi, DOMMatrix: oi, DOMMatrixReadOnly: oi, DOMParser: oi, DOMPoint: oi, DOMPointReadOnly: oi, DOMQuad: oi, DOMRect: oi, DOMRectReadOnly: oi, DOMStringList: oi, DOMStringMap: oi, DOMTokenList: oi, DragEvent: oi, DynamicsCompressorNode: oi, Element: oi, ErrorEvent: oi, Event: oi, EventSource: oi, EventTarget: oi, external: ni, fetch: ni, File: oi, FileList: oi, FileReader: oi, find: ni, focus: ni, FocusEvent: oi, FontFace: oi, FontFaceSetLoadEvent: oi, FormData: oi, frames: ni, GainNode: oi, Gamepad: oi, GamepadButton: oi, GamepadEvent: oi, getComputedStyle: ni, getSelection: ni, HashChangeEvent: oi, Headers: oi, history: ni, History: oi, HTMLAllCollection: oi, HTMLAnchorElement: oi, HTMLAreaElement: oi, HTMLAudioElement: oi, HTMLBaseElement: oi, HTMLBodyElement: oi, HTMLBRElement: oi, HTMLButtonElement: oi, HTMLCanvasElement: oi, HTMLCollection: oi, HTMLContentElement: oi, HTMLDataElement: oi, HTMLDataListElement: oi, HTMLDetailsElement: oi, HTMLDialogElement: oi, HTMLDirectoryElement: oi, HTMLDivElement: oi, HTMLDListElement: oi, HTMLDocument: oi, HTMLElement: oi, HTMLEmbedElement: oi, HTMLFieldSetElement: oi, HTMLFontElement: oi, HTMLFormControlsCollection: oi, HTMLFormElement: oi, HTMLFrameElement: oi, HTMLFrameSetElement: oi, HTMLHeadElement: oi, HTMLHeadingElement: oi, HTMLHRElement: oi, HTMLHtmlElement: oi, HTMLIFrameElement: oi, HTMLImageElement: oi, HTMLInputElement: oi, HTMLLabelElement: oi, HTMLLegendElement: oi, HTMLLIElement: oi, HTMLLinkElement: oi, HTMLMapElement: oi, HTMLMarqueeElement: oi, HTMLMediaElement: oi, HTMLMenuElement: oi, HTMLMetaElement: oi, HTMLMeterElement: oi, HTMLModElement: oi, HTMLObjectElement: oi, HTMLOListElement: oi, HTMLOptGroupElement: oi, HTMLOptionElement: oi, HTMLOptionsCollection: oi, HTMLOutputElement: oi, HTMLParagraphElement: oi, HTMLParamElement: oi, HTMLPictureElement: oi, HTMLPreElement: oi, HTMLProgressElement: oi, HTMLQuoteElement: oi, HTMLScriptElement: oi, HTMLSelectElement: oi, HTMLShadowElement: oi, HTMLSlotElement: oi, HTMLSourceElement: oi, HTMLSpanElement: oi, HTMLStyleElement: oi, HTMLTableCaptionElement: oi, HTMLTableCellElement: oi, HTMLTableColElement: oi, HTMLTableElement: oi, HTMLTableRowElement: oi, HTMLTableSectionElement: oi, HTMLTemplateElement: oi, HTMLTextAreaElement: oi, HTMLTimeElement: oi, HTMLTitleElement: oi, HTMLTrackElement: oi, HTMLUListElement: oi, HTMLUnknownElement: oi, HTMLVideoElement: oi, IDBCursor: oi, IDBCursorWithValue: oi, IDBDatabase: oi, IDBFactory: oi, IDBIndex: oi, IDBKeyRange: oi, IDBObjectStore: oi, IDBOpenDBRequest: oi, IDBRequest: oi, IDBTransaction: oi, IDBVersionChangeEvent: oi, IdleDeadline: oi, IIRFilterNode: oi, Image: oi, ImageBitmap: oi, ImageBitmapRenderingContext: oi, ImageCapture: oi, ImageData: oi, indexedDB: ni, innerHeight: ni, innerWidth: ni, InputEvent: oi, IntersectionObserver: oi, IntersectionObserverEntry: oi, isSecureContext: ni, KeyboardEvent: oi, KeyframeEffect: oi, length: ni, localStorage: ni, location: ni, Location: oi, locationbar: ni, matchMedia: ni, MediaDeviceInfo: oi, MediaDevices: oi, MediaElementAudioSourceNode: oi, MediaEncryptedEvent: oi, MediaError: oi, MediaKeyMessageEvent: oi, MediaKeySession: oi, MediaKeyStatusMap: oi, MediaKeySystemAccess: oi, MediaList: oi, MediaQueryList: oi, MediaQueryListEvent: oi, MediaRecorder: oi, MediaSettingsRange: oi, MediaSource: oi, MediaStream: oi, MediaStreamAudioDestinationNode: oi, MediaStreamAudioSourceNode: oi, MediaStreamEvent: oi, MediaStreamTrack: oi, MediaStreamTrackEvent: oi, menubar: ni, MessageChannel: oi, MessageEvent: oi, MessagePort: oi, MIDIAccess: oi, MIDIConnectionEvent: oi, MIDIInput: oi, MIDIInputMap: oi, MIDIMessageEvent: oi, MIDIOutput: oi, MIDIOutputMap: oi, MIDIPort: oi, MimeType: oi, MimeTypeArray: oi, MouseEvent: oi, moveBy: ni, moveTo: ni, MutationEvent: oi, MutationObserver: oi, MutationRecord: oi, name: ni, NamedNodeMap: oi, NavigationPreloadManager: oi, navigator: ni, Navigator: oi, NetworkInformation: oi, Node: oi, NodeFilter: ni, NodeIterator: oi, NodeList: oi, Notification: oi, OfflineAudioCompletionEvent: oi, OfflineAudioContext: oi, offscreenBuffering: ni, OffscreenCanvas: oi, open: ni, openDatabase: ni, Option: oi, origin: ni, OscillatorNode: oi, outerHeight: ni, outerWidth: ni, PageTransitionEvent: oi, pageXOffset: ni, pageYOffset: ni, PannerNode: oi, parent: ni, Path2D: oi, PaymentAddress: oi, PaymentRequest: oi, PaymentRequestUpdateEvent: oi, PaymentResponse: oi, performance: ni, Performance: oi, PerformanceEntry: oi, PerformanceLongTaskTiming: oi, PerformanceMark: oi, PerformanceMeasure: oi, PerformanceNavigation: oi, PerformanceNavigationTiming: oi, PerformanceObserver: oi, PerformanceObserverEntryList: oi, PerformancePaintTiming: oi, PerformanceResourceTiming: oi, PerformanceTiming: oi, PeriodicWave: oi, Permissions: oi, PermissionStatus: oi, personalbar: ni, PhotoCapabilities: oi, Plugin: oi, PluginArray: oi, PointerEvent: oi, PopStateEvent: oi, postMessage: ni, Presentation: oi, PresentationAvailability: oi, PresentationConnection: oi, PresentationConnectionAvailableEvent: oi, PresentationConnectionCloseEvent: oi, PresentationConnectionList: oi, PresentationReceiver: oi, PresentationRequest: oi, print: ni, ProcessingInstruction: oi, ProgressEvent: oi, PromiseRejectionEvent: oi, prompt: ni, PushManager: oi, PushSubscription: oi, PushSubscriptionOptions: oi, queueMicrotask: ni, RadioNodeList: oi, Range: oi, ReadableStream: oi, RemotePlayback: oi, removeEventListener: ni, Request: oi, requestAnimationFrame: ni, requestIdleCallback: ni, resizeBy: ni, ResizeObserver: oi, ResizeObserverEntry: oi, resizeTo: ni, Response: oi, RTCCertificate: oi, RTCDataChannel: oi, RTCDataChannelEvent: oi, RTCDtlsTransport: oi, RTCIceCandidate: oi, RTCIceTransport: oi, RTCPeerConnection: oi, RTCPeerConnectionIceEvent: oi, RTCRtpReceiver: oi, RTCRtpSender: oi, RTCSctpTransport: oi, RTCSessionDescription: oi, RTCStatsReport: oi, RTCTrackEvent: oi, screen: ni, Screen: oi, screenLeft: ni, ScreenOrientation: oi, screenTop: ni, screenX: ni, screenY: ni, ScriptProcessorNode: oi, scroll: ni, scrollbars: ni, scrollBy: ni, scrollTo: ni, scrollX: ni, scrollY: ni, SecurityPolicyViolationEvent: oi, Selection: oi, ServiceWorker: oi, ServiceWorkerContainer: oi, ServiceWorkerRegistration: oi, sessionStorage: ni, ShadowRoot: oi, SharedWorker: oi, SourceBuffer: oi, SourceBufferList: oi, speechSynthesis: ni, SpeechSynthesisEvent: oi, SpeechSynthesisUtterance: oi, StaticRange: oi, status: ni, statusbar: ni, StereoPannerNode: oi, stop: ni, Storage: oi, StorageEvent: oi, StorageManager: oi, styleMedia: ni, StyleSheet: oi, StyleSheetList: oi, SubtleCrypto: oi, SVGAElement: oi, SVGAngle: oi, SVGAnimatedAngle: oi, SVGAnimatedBoolean: oi, SVGAnimatedEnumeration: oi, SVGAnimatedInteger: oi, SVGAnimatedLength: oi, SVGAnimatedLengthList: oi, SVGAnimatedNumber: oi, SVGAnimatedNumberList: oi, SVGAnimatedPreserveAspectRatio: oi, SVGAnimatedRect: oi, SVGAnimatedString: oi, SVGAnimatedTransformList: oi, SVGAnimateElement: oi, SVGAnimateMotionElement: oi, SVGAnimateTransformElement: oi, SVGAnimationElement: oi, SVGCircleElement: oi, SVGClipPathElement: oi, SVGComponentTransferFunctionElement: oi, SVGDefsElement: oi, SVGDescElement: oi, SVGDiscardElement: oi, SVGElement: oi, SVGEllipseElement: oi, SVGFEBlendElement: oi, SVGFEColorMatrixElement: oi, SVGFEComponentTransferElement: oi, SVGFECompositeElement: oi, SVGFEConvolveMatrixElement: oi, SVGFEDiffuseLightingElement: oi, SVGFEDisplacementMapElement: oi, SVGFEDistantLightElement: oi, SVGFEDropShadowElement: oi, SVGFEFloodElement: oi, SVGFEFuncAElement: oi, SVGFEFuncBElement: oi, SVGFEFuncGElement: oi, SVGFEFuncRElement: oi, SVGFEGaussianBlurElement: oi, SVGFEImageElement: oi, SVGFEMergeElement: oi, SVGFEMergeNodeElement: oi, SVGFEMorphologyElement: oi, SVGFEOffsetElement: oi, SVGFEPointLightElement: oi, SVGFESpecularLightingElement: oi, SVGFESpotLightElement: oi, SVGFETileElement: oi, SVGFETurbulenceElement: oi, SVGFilterElement: oi, SVGForeignObjectElement: oi, SVGGElement: oi, SVGGeometryElement: oi, SVGGradientElement: oi, SVGGraphicsElement: oi, SVGImageElement: oi, SVGLength: oi, SVGLengthList: oi, SVGLinearGradientElement: oi, SVGLineElement: oi, SVGMarkerElement: oi, SVGMaskElement: oi, SVGMatrix: oi, SVGMetadataElement: oi, SVGMPathElement: oi, SVGNumber: oi, SVGNumberList: oi, SVGPathElement: oi, SVGPatternElement: oi, SVGPoint: oi, SVGPointList: oi, SVGPolygonElement: oi, SVGPolylineElement: oi, SVGPreserveAspectRatio: oi, SVGRadialGradientElement: oi, SVGRect: oi, SVGRectElement: oi, SVGScriptElement: oi, SVGSetElement: oi, SVGStopElement: oi, SVGStringList: oi, SVGStyleElement: oi, SVGSVGElement: oi, SVGSwitchElement: oi, SVGSymbolElement: oi, SVGTextContentElement: oi, SVGTextElement: oi, SVGTextPathElement: oi, SVGTextPositioningElement: oi, SVGTitleElement: oi, SVGTransform: oi, SVGTransformList: oi, SVGTSpanElement: oi, SVGUnitTypes: oi, SVGUseElement: oi, SVGViewElement: oi, TaskAttributionTiming: oi, Text: oi, TextEvent: oi, TextMetrics: oi, TextTrack: oi, TextTrackCue: oi, TextTrackCueList: oi, TextTrackList: oi, TimeRanges: oi, toolbar: ni, top: ni, Touch: oi, TouchEvent: oi, TouchList: oi, TrackEvent: oi, TransitionEvent: oi, TreeWalker: oi, UIEvent: oi, ValidityState: oi, visualViewport: ni, VisualViewport: oi, VTTCue: oi, WaveShaperNode: oi, WebAssembly: ni, WebGL2RenderingContext: oi, WebGLActiveInfo: oi, WebGLBuffer: oi, WebGLContextEvent: oi, WebGLFramebuffer: oi, WebGLProgram: oi, WebGLQuery: oi, WebGLRenderbuffer: oi, WebGLRenderingContext: oi, WebGLSampler: oi, WebGLShader: oi, WebGLShaderPrecisionFormat: oi, WebGLSync: oi, WebGLTexture: oi, WebGLTransformFeedback: oi, WebGLUniformLocation: oi, WebGLVertexArrayObject: oi, WebSocket: oi, WheelEvent: oi, Window: oi, Worker: oi, WritableStream: oi, XMLDocument: oi, XMLHttpRequest: oi, XMLHttpRequestEventTarget: oi, XMLHttpRequestUpload: oi, XMLSerializer: oi, XPathEvaluator: oi, XPathExpression: oi, XPathResult: oi, XSLTProcessor: oi };
for (const e4 of ["window", "global", "self", "globalThis"])
  di[e4] = di;
function hi(e4) {
  let t2 = di;
  for (const n2 of e4) {
    if ("string" != typeof n2)
      return null;
    if (t2 = t2[n2], !t2)
      return null;
  }
  return t2[Ks];
}
class pi extends xe {
  constructor(e4) {
    super(e4), this.markReassigned();
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    switch (e4.type) {
      case 0:
      case 1:
        return void (hi([this.name, ...t2].slice(0, -1)) || super.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2));
      case 2: {
        const s2 = hi([this.name, ...t2]);
        return void (s2 ? s2.deoptimizeArgumentsOnCall(e4) : super.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2));
      }
    }
  }
  getLiteralValueAtPath(e4, t2, n2) {
    const s2 = hi([this.name, ...e4]);
    return s2 ? s2.getLiteralValue() : re;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    switch (t2.type) {
      case 0:
        return 0 === e4.length ? "undefined" !== this.name && !hi([this.name]) : !hi([this.name, ...e4].slice(0, -1));
      case 1:
        return true;
      case 2: {
        const s2 = hi([this.name, ...e4]);
        return !s2 || s2.hasEffectsWhenCalled(t2, n2);
      }
    }
  }
}
class fi extends xe {
  constructor(e4, t2, n2, s2, i2) {
    super(e4), this.init = n2, this.calledFromTryStatement = false, this.additionalInitializers = null, this.expressionsToBeDeoptimized = [], this.declarations = t2 ? [t2] : [], this.deoptimizationTracker = s2.deoptimizationTracker, this.module = s2.module, this.kind = i2;
  }
  addDeclaration(e4, t2) {
    this.declarations.push(e4), this.markInitializersForDeoptimization().push(t2);
  }
  consolidateInitializers() {
    if (this.additionalInitializers) {
      for (const e4 of this.additionalInitializers)
        e4.deoptimizePath(J);
      this.additionalInitializers = null;
    }
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.isReassigned ? ue(e4) : n2.withTrackedEntityAtPath(t2, this.init, () => this.init.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2), void 0);
  }
  deoptimizePath(e4) {
    if (!this.isReassigned && !this.deoptimizationTracker.trackEntityAtPathAndGetIfTracked(e4, this))
      if (0 === e4.length) {
        this.markReassigned();
        const e5 = this.expressionsToBeDeoptimized;
        this.expressionsToBeDeoptimized = we;
        for (const t2 of e5)
          t2.deoptimizeCache();
        this.init.deoptimizePath(J);
      } else
        this.init.deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.isReassigned ? re : t2.withTrackedEntityAtPath(e4, this.init, () => (this.expressionsToBeDeoptimized.push(n2), this.init.getLiteralValueAtPath(e4, t2, n2)), re);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return this.isReassigned ? ce : n2.withTrackedEntityAtPath(e4, this.init, () => (this.expressionsToBeDeoptimized.push(s2), this.init.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2)), ce);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    switch (t2.type) {
      case 0:
        return !!this.isReassigned || !n2.accessed.trackEntityAtPathAndGetIfTracked(e4, this) && this.init.hasEffectsOnInteractionAtPath(e4, t2, n2);
      case 1:
        return !!this.included || 0 !== e4.length && (!!this.isReassigned || !n2.assigned.trackEntityAtPathAndGetIfTracked(e4, this) && this.init.hasEffectsOnInteractionAtPath(e4, t2, n2));
      case 2:
        return !!this.isReassigned || !(t2.withNew ? n2.instantiated : n2.called).trackEntityAtPathAndGetIfTracked(e4, t2.args, this) && this.init.hasEffectsOnInteractionAtPath(e4, t2, n2);
    }
  }
  include() {
    if (!this.included) {
      super.include();
      for (const e4 of this.declarations) {
        e4.included || e4.include(Fn(), false);
        let t2 = e4.parent;
        for (; !t2.included && (t2.included = true, t2.type !== Ee); )
          t2 = t2.parent;
      }
    }
  }
  includeCallArguments(e4, t2) {
    if (this.isReassigned || e4.includedCallArguments.has(this.init))
      for (const n2 of t2)
        n2.include(e4, false);
    else
      e4.includedCallArguments.add(this.init), this.init.includeCallArguments(e4, t2), e4.includedCallArguments.delete(this.init);
  }
  markCalledFromTryStatement() {
    this.calledFromTryStatement = true;
  }
  markInitializersForDeoptimization() {
    return null === this.additionalInitializers && (this.additionalInitializers = [this.init], this.init = le, this.markReassigned()), this.additionalInitializers;
  }
}
const mi = /* @__PURE__ */ new Set(["class", "const", "let", "var", "using", "await using"]);
class gi extends bs {
  constructor() {
    super(...arguments), this.variable = null, this.isReferenceVariable = false;
  }
  get isTDZAccess() {
    return se(this.flags, 4) ? se(this.flags, 8) : null;
  }
  set isTDZAccess(e4) {
    this.flags = ie(this.flags, 4, true), this.flags = ie(this.flags, 8, e4);
  }
  addExportedVariables(e4, t2) {
    t2.has(this.variable) && e4.push(this.variable);
  }
  bind() {
    !this.variable && Ws(this, this.parent) && (this.variable = this.scope.findVariable(this.name), this.variable.addReference(this), this.isReferenceVariable = true);
  }
  declare(e4, t2) {
    let n2;
    const { treeshake: s2 } = this.scope.context.options;
    switch (e4) {
      case "var":
        n2 = this.scope.addDeclaration(this, this.scope.context, t2, e4), s2 && s2.correctVarValueBeforeDeclaration && n2.markInitializersForDeoptimization();
        break;
      case "function":
      case "let":
      case "const":
      case "using":
      case "await using":
      case "class":
        n2 = this.scope.addDeclaration(this, this.scope.context, t2, e4);
        break;
      case "parameter":
        n2 = this.scope.addParameterDeclaration(this);
        break;
      default:
        throw new Error(`Internal Error: Unexpected identifier kind ${e4}.`);
    }
    return [this.variable = n2];
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.variable.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizePath(e4) {
    var _a3;
    0 !== e4.length || this.scope.contains(this.name) || this.disallowImportReassignment(), (_a3 = this.variable) == null ? void 0 : _a3.deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.getVariableRespectingTDZ().getLiteralValueAtPath(e4, t2, n2);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    const [i2, r2] = this.getVariableRespectingTDZ().getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2);
    return [i2, r2 || this.isPureFunction(e4)];
  }
  hasEffects(e4) {
    return this.deoptimized || this.applyDeoptimizations(), !(!this.isPossibleTDZ() || "var" === this.variable.kind) || this.scope.context.options.treeshake.unknownGlobalSideEffects && this.variable instanceof pi && !this.isPureFunction(Y) && this.variable.hasEffectsOnInteractionAtPath(Y, de, e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    switch (t2.type) {
      case 0:
        return null !== this.variable && !this.isPureFunction(e4) && this.getVariableRespectingTDZ().hasEffectsOnInteractionAtPath(e4, t2, n2);
      case 1:
        return (e4.length > 0 ? this.getVariableRespectingTDZ() : this.variable).hasEffectsOnInteractionAtPath(e4, t2, n2);
      case 2:
        return !this.isPureFunction(e4) && this.getVariableRespectingTDZ().hasEffectsOnInteractionAtPath(e4, t2, n2);
    }
  }
  include() {
    this.deoptimized || this.applyDeoptimizations(), this.included || (this.included = true, null !== this.variable && this.scope.context.includeVariableInModule(this.variable));
  }
  includeCallArguments(e4, t2) {
    this.variable.includeCallArguments(e4, t2);
  }
  isPossibleTDZ() {
    const e4 = this.isTDZAccess;
    if (null !== e4)
      return e4;
    if (!(this.variable instanceof fi && this.variable.kind && mi.has(this.variable.kind) && this.variable.module === this.scope.context.module))
      return this.isTDZAccess = false;
    let t2;
    return this.variable.declarations && 1 === this.variable.declarations.length && (t2 = this.variable.declarations[0]) && this.start < t2.start && yi(this) === yi(t2) || !this.variable.initReached && this.scope.context.module.isExecuted ? this.isTDZAccess = true : this.isTDZAccess = false;
  }
  markDeclarationReached() {
    this.variable.initReached = true;
  }
  render(e4, { snippets: { getPropertyAccess: t2 }, useOriginalName: n2 }, { renderedParentType: s2, isCalleeOfRenderedParent: i2, isShorthandProperty: r2 } = Ae) {
    if (this.variable) {
      const o2 = this.variable.getName(t2, n2);
      o2 !== this.name && (e4.overwrite(this.start, this.end, o2, { contentOnly: true, storeName: true }), r2 && e4.prependRight(this.start, `${this.name}: `)), "eval" === o2 && s2 === me && i2 && e4.appendRight(this.start, "0, ");
    }
  }
  disallowImportReassignment() {
    return this.scope.context.error(Qt(this.name, this.scope.context.module.id), this.start);
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.variable instanceof fi && (this.variable.consolidateInitializers(), this.scope.context.requestTreeshakingPass()), this.isReferenceVariable && (this.variable.addUsedPlace(this), this.scope.context.requestTreeshakingPass());
  }
  getVariableRespectingTDZ() {
    return this.isPossibleTDZ() ? le : this.variable;
  }
  isPureFunction(e4) {
    let t2 = this.scope.context.manualPureFunctions[this.name];
    for (const n2 of e4) {
      if (!t2)
        return false;
      if (t2[qs])
        return true;
      t2 = t2[n2];
    }
    return t2 == null ? void 0 : t2[qs];
  }
}
function yi(e4) {
  for (; e4 && !/^Program|Function/.test(e4.type); )
    e4 = e4.parent;
  return e4;
}
const bi = we, Ei = /* @__PURE__ */ new Set([W]), xi = new ee(), $i = /* @__PURE__ */ new Set([le]);
class Ai extends fi {
  constructor(e4, t2, n2) {
    super(e4, t2, le, n2, "parameter"), this.deoptimizationInteractions = [], this.deoptimizations = new ee(), this.deoptimizedFields = /* @__PURE__ */ new Set(), this.entitiesToBeDeoptimized = /* @__PURE__ */ new Set(), this.expressionsUseTheKnownValue = [], this.knownValue = null, this.knownValueLiteral = re, this.frozenValue = null;
  }
  addEntityToBeDeoptimized(e4) {
    if (e4 === le) {
      if (!this.entitiesToBeDeoptimized.has(le)) {
        this.entitiesToBeDeoptimized.add(le);
        for (const { interaction: e5 } of this.deoptimizationInteractions)
          ue(e5);
        this.deoptimizationInteractions = bi;
      }
    } else if (this.deoptimizedFields.has(W))
      e4.deoptimizePath(J);
    else if (!this.entitiesToBeDeoptimized.has(e4)) {
      this.entitiesToBeDeoptimized.add(e4);
      for (const t2 of this.deoptimizedFields)
        e4.deoptimizePath([t2]);
      for (const { interaction: t2, path: n2 } of this.deoptimizationInteractions)
        e4.deoptimizeArgumentsOnInteractionAtPath(t2, n2, te);
    }
  }
  markReassigned() {
    if (!this.isReassigned) {
      super.markReassigned();
      for (const e4 of this.expressionsUseTheKnownValue)
        e4.deoptimizeCache();
      this.expressionsUseTheKnownValue = we;
    }
  }
  deoptimizeCache() {
    this.markReassigned();
  }
  updateKnownValue(e4) {
    if (this.isReassigned)
      return;
    if (null === this.knownValue)
      return this.knownValue = e4, void (this.knownValueLiteral = e4.getLiteralValueAtPath(Y, te, this));
    if (this.knownValue === e4 || this.knownValue instanceof gi && e4 instanceof gi && this.knownValue.variable === e4.variable)
      return;
    const t2 = this.knownValueLiteral;
    if ("symbol" == typeof t2)
      return void this.markReassigned();
    e4.getLiteralValueAtPath(Y, te, this) !== t2 && this.markReassigned();
  }
  getKnownValue() {
    return null === this.frozenValue && (this.frozenValue = this.knownValue || le), this.frozenValue;
  }
  getLiteralValueAtPath(e4, t2, n2) {
    if (this.isReassigned)
      return re;
    const s2 = this.getKnownValue();
    return this.expressionsUseTheKnownValue.push(n2), t2.withTrackedEntityAtPath(e4, s2, () => s2.getLiteralValueAtPath(e4, t2, n2), re);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    if (this.isReassigned || 1 === t2.type)
      return super.hasEffectsOnInteractionAtPath(e4, t2, n2);
    return this.getKnownValue().hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2) {
    if (t2.length >= 2 || this.entitiesToBeDeoptimized.has(le) || this.deoptimizationInteractions.length >= 20 || 1 === t2.length && (this.deoptimizedFields.has(W) || 2 === e4.type && this.deoptimizedFields.has(t2[0])))
      ue(e4);
    else if (!this.deoptimizations.trackEntityAtPathAndGetIfTracked(t2, e4.args)) {
      for (const n2 of this.entitiesToBeDeoptimized)
        n2.deoptimizeArgumentsOnInteractionAtPath(e4, t2, te);
      this.entitiesToBeDeoptimized.has(le) || this.deoptimizationInteractions.push({ interaction: e4, path: t2 });
    }
  }
  deoptimizePath(e4) {
    if (0 === e4.length)
      return void this.markReassigned();
    if (this.deoptimizedFields.has(W))
      return;
    const t2 = e4[0];
    if (!this.deoptimizedFields.has(t2)) {
      this.deoptimizedFields.add(t2);
      for (const e5 of this.entitiesToBeDeoptimized)
        e5.deoptimizePath([t2]);
      t2 === W && (this.deoptimizationInteractions = bi, this.deoptimizations = xi, this.deoptimizedFields = Ei, this.entitiesToBeDeoptimized = $i);
    }
  }
  getReturnExpressionWhenCalledAtPath(e4) {
    return 0 === e4.length ? this.deoptimizePath(J) : this.deoptimizedFields.has(e4[0]) || this.deoptimizePath([e4[0]]), ce;
  }
}
const Si = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$", wi = 64;
function vi(e4) {
  let t2 = "";
  do {
    const n2 = e4 % wi;
    e4 = e4 / wi | 0, t2 = Si[n2] + t2;
  } while (0 !== e4);
  return t2;
}
function Pi(e4, t2, n2) {
  let s2 = e4, i2 = 1;
  for (; t2.has(s2) || Ie.has(s2) || (n2 == null ? void 0 : n2.has(s2)); )
    s2 = `${e4}$${vi(i2++)}`;
  return t2.add(s2), s2;
}
class Ii {
  constructor() {
    this.children = [], this.variables = /* @__PURE__ */ new Map();
  }
  addDeclaration(e4, t2, n2, s2) {
    var _a3;
    const i2 = e4.name, r2 = ((_a3 = this.hoistedVariables) == null ? void 0 : _a3.get(i2)) || this.variables.get(i2);
    if (r2) {
      const o3 = r2.kind;
      if ("var" === s2 && "var" === o3)
        return r2.addDeclaration(e4, n2), r2;
      t2.error(dn(i2), e4.start);
    }
    const o2 = new fi(e4.name, e4, n2, t2, s2);
    return this.variables.set(i2, o2), o2;
  }
  addHoistedVariable(e4, t2) {
    (this.hoistedVariables || (this.hoistedVariables = /* @__PURE__ */ new Map())).set(e4, t2);
  }
  contains(e4) {
    return this.variables.has(e4);
  }
  findVariable(e4) {
    throw new Error("Internal Error: findVariable needs to be implemented by a subclass");
  }
}
class ki extends Ii {
  constructor(e4, t2) {
    super(), this.parent = e4, this.context = t2, this.accessedOutsideVariables = /* @__PURE__ */ new Map(), e4.children.push(this);
  }
  addAccessedDynamicImport(e4) {
    (this.accessedDynamicImports || (this.accessedDynamicImports = /* @__PURE__ */ new Set())).add(e4), this.parent instanceof ki && this.parent.addAccessedDynamicImport(e4);
  }
  addAccessedGlobals(e4, t2) {
    const n2 = t2.get(this) || /* @__PURE__ */ new Set();
    for (const t3 of e4)
      n2.add(t3);
    t2.set(this, n2), this.parent instanceof ki && this.parent.addAccessedGlobals(e4, t2);
  }
  addNamespaceMemberAccess(e4, t2) {
    this.accessedOutsideVariables.set(e4, t2), this.parent.addNamespaceMemberAccess(e4, t2);
  }
  addReturnExpression(e4) {
    this.parent instanceof ki && this.parent.addReturnExpression(e4);
  }
  addUsedOutsideNames(e4, t2, n2, s2) {
    for (const s3 of this.accessedOutsideVariables.values())
      s3.included && (e4.add(s3.getBaseVariableName()), "system" === t2 && n2.has(s3) && e4.add("exports"));
    const i2 = s2.get(this);
    if (i2)
      for (const t3 of i2)
        e4.add(t3);
  }
  contains(e4) {
    return this.variables.has(e4) || this.parent.contains(e4);
  }
  deconflict(e4, t2, n2) {
    const s2 = /* @__PURE__ */ new Set();
    if (this.addUsedOutsideNames(s2, e4, t2, n2), this.accessedDynamicImports)
      for (const e5 of this.accessedDynamicImports)
        e5.inlineNamespace && s2.add(e5.inlineNamespace.getBaseVariableName());
    for (const [e5, t3] of this.variables)
      (t3.included || t3.alwaysRendered) && t3.setRenderNames(null, Pi(e5, s2, t3.forbiddenNames));
    for (const s3 of this.children)
      s3.deconflict(e4, t2, n2);
  }
  findLexicalBoundary() {
    return this.parent.findLexicalBoundary();
  }
  findVariable(e4) {
    const t2 = this.variables.get(e4) || this.accessedOutsideVariables.get(e4);
    if (t2)
      return t2;
    const n2 = this.parent.findVariable(e4);
    return this.accessedOutsideVariables.set(e4, n2), n2;
  }
}
class Ni extends ki {
  constructor(e4) {
    super(e4, e4.context), this.parent = e4;
  }
  addDeclaration(e4, t2, n2, s2) {
    var _a3;
    if ("var" === s2) {
      const i2 = e4.name, r2 = ((_a3 = this.hoistedVariables) == null ? void 0 : _a3.get(i2)) || this.variables.get(i2);
      if (r2) {
        const o3 = r2.kind;
        if ("parameter" === o3 && "CatchClause" === r2.declarations[0].parent.type) {
          const n3 = this.parent.parent.addDeclaration(e4, t2, es, s2);
          return r2.renderLikeHoisted(n3), this.addHoistedVariable(i2, n3), n3;
        }
        return "var" === o3 ? (r2.addDeclaration(e4, n2), r2) : t2.error(dn(i2), e4.start);
      }
      const o2 = this.parent.parent.addDeclaration(e4, t2, n2, s2);
      return o2.markInitializersForDeoptimization(), this.addHoistedVariable(i2, o2), o2;
    }
    return super.addDeclaration(e4, t2, n2, s2);
  }
}
class Ci extends ki {
  constructor(e4) {
    super(e4, e4.context);
  }
  addDeclaration(e4, t2, n2, s2) {
    var _a3;
    const i2 = e4.name, r2 = ((_a3 = this.hoistedVariables) == null ? void 0 : _a3.get(i2)) || this.variables.get(i2);
    if (r2) {
      const o3 = r2.kind;
      if (!("var" !== s2 && "function" !== s2 || "var" !== o3 && "function" !== o3 && "parameter" !== o3))
        return r2.addDeclaration(e4, n2), r2;
      t2.error(dn(i2), e4.start);
    }
    const o2 = new fi(e4.name, e4, n2, t2, s2);
    return this.variables.set(i2, o2), o2;
  }
}
class Oi extends ki {
  constructor(e4, t2) {
    super(e4, e4.context), this.parameters = [], this.hasRest = false, this.bodyScope = t2 ? new Ni(this) : new Ci(this);
  }
  addParameterDeclaration(e4) {
    const { name: t2, start: n2 } = e4;
    if (this.variables.get(t2))
      return this.context.error(function(e5) {
        return { code: "DUPLICATE_ARGUMENT_NAME", message: `Duplicate argument name "${e5}"` };
      }(t2), n2);
    const s2 = new Ai(t2, e4, this.context);
    return this.variables.set(t2, s2), this.bodyScope.addHoistedVariable(t2, s2), s2;
  }
  addParameterVariables(e4, t2) {
    this.parameters = e4;
    for (const t3 of e4)
      for (const e5 of t3)
        e5.alwaysRendered = true;
    this.hasRest = t2;
  }
  includeCallArguments(e4, t2) {
    let n2 = false, s2 = false;
    const i2 = this.hasRest && this.parameters[this.parameters.length - 1];
    for (const n3 of t2)
      if (n3 instanceof Es) {
        for (const n4 of t2)
          n4.include(e4, false);
        break;
      }
    for (let r2 = t2.length - 1; r2 >= 0; r2--) {
      const o2 = this.parameters[r2] || i2, a2 = t2[r2];
      if (o2)
        if (n2 = false, 0 === o2.length)
          s2 = true;
        else
          for (const e5 of o2)
            e5.included && (s2 = true), e5.calledFromTryStatement && (n2 = true);
      !s2 && a2.shouldBeIncluded(e4) && (s2 = true), s2 && a2.include(e4, n2);
    }
  }
}
class Di extends Oi {
  constructor() {
    super(...arguments), this.returnExpression = null, this.returnExpressions = [];
  }
  addReturnExpression(e4) {
    this.returnExpressions.push(e4);
  }
  getReturnExpression() {
    return null === this.returnExpression && this.updateReturnExpression(), this.returnExpression;
  }
  updateReturnExpression() {
    if (1 === this.returnExpressions.length)
      this.returnExpression = this.returnExpressions[0];
    else {
      this.returnExpression = le;
      for (const e4 of this.returnExpressions)
        e4.deoptimizePath(J);
    }
  }
}
function Mi(e4, t2, n2, s2) {
  t2.remove(n2, s2), e4.removeAnnotations(t2);
}
const Ri = { isNoStatement: true };
function _i(e4, t2, n2 = 0) {
  let s2, i2;
  for (s2 = e4.indexOf(t2, n2); ; ) {
    if (-1 === (n2 = e4.indexOf("/", n2)) || n2 >= s2)
      return s2;
    i2 = e4.charCodeAt(++n2), ++n2, (n2 = 47 === i2 ? e4.indexOf("\n", n2) + 1 : e4.indexOf("*/", n2) + 2) > s2 && (s2 = e4.indexOf(t2, n2));
  }
}
const Li = /\S/g;
function Bi(e4, t2) {
  Li.lastIndex = t2;
  return Li.exec(e4).index;
}
function Ti(e4) {
  let t2, n2, s2 = 0;
  for (t2 = e4.indexOf("\n", s2); ; ) {
    if (s2 = e4.indexOf("/", s2), -1 === s2 || s2 > t2)
      return [t2, t2 + 1];
    if (n2 = e4.charCodeAt(s2 + 1), 47 === n2)
      return [s2, t2 + 1];
    s2 = e4.indexOf("*/", s2 + 2) + 2, s2 > t2 && (t2 = e4.indexOf("\n", s2));
  }
}
function zi(e4, t2, n2, s2, i2) {
  let r2, o2, a2, l2, c2 = e4[0], u2 = !c2.included || c2.needsBoundaries;
  u2 && (l2 = n2 + Ti(t2.original.slice(n2, c2.start))[1]);
  for (let n3 = 1; n3 <= e4.length; n3++)
    r2 = c2, o2 = l2, a2 = u2, c2 = e4[n3], u2 = void 0 !== c2 && (!c2.included || c2.needsBoundaries), a2 || u2 ? (l2 = r2.end + Ti(t2.original.slice(r2.end, void 0 === c2 ? s2 : c2.start))[1], r2.included ? a2 ? r2.render(t2, i2, { end: l2, start: o2 }) : r2.render(t2, i2) : Mi(r2, t2, o2, l2)) : r2.render(t2, i2);
}
function Vi(e4, t2, n2, s2) {
  const i2 = [];
  let r2, o2, a2, l2, c2 = n2 - 1;
  for (const s3 of e4) {
    for (void 0 !== r2 && (c2 = r2.end + _i(t2.original.slice(r2.end, s3.start), ",")), o2 = a2 = c2 + 1 + Ti(t2.original.slice(c2 + 1, s3.start))[1]; l2 = t2.original.charCodeAt(o2), 32 === l2 || 9 === l2 || 10 === l2 || 13 === l2; )
      o2++;
    void 0 !== r2 && i2.push({ contentEnd: a2, end: o2, node: r2, separator: c2, start: n2 }), r2 = s3, n2 = o2;
  }
  return i2.push({ contentEnd: s2, end: s2, node: r2, separator: null, start: n2 }), i2;
}
function Fi(e4, t2, n2) {
  for (; ; ) {
    const [s2, i2] = Ti(e4.original.slice(t2, n2));
    if (-1 === s2)
      break;
    e4.remove(t2 + s2, t2 += i2);
  }
}
class ji extends ki {
  constructor(e4) {
    super(e4, e4.context);
  }
  addDeclaration(e4, t2, n2, s2) {
    var _a3;
    if ("var" === s2) {
      const i2 = e4.name, r2 = ((_a3 = this.hoistedVariables) == null ? void 0 : _a3.get(i2)) || this.variables.get(i2);
      if (r2)
        return "var" === r2.kind || "var" === s2 && "parameter" === r2.kind ? (r2.addDeclaration(e4, n2), r2) : t2.error(dn(i2), e4.start);
      const o2 = this.parent.addDeclaration(e4, t2, n2, s2);
      return o2.markInitializersForDeoptimization(), this.addHoistedVariable(i2, o2), o2;
    }
    return super.addDeclaration(e4, t2, n2, s2);
  }
}
class Ui extends bs {
  initialise() {
    var e4, t2;
    super.initialise(), this.directive && "use strict" !== this.directive && this.parent.type === Ee && this.scope.context.log(Le, (e4 = this.directive, { code: "MODULE_LEVEL_DIRECTIVE", id: t2 = this.scope.context.module.id, message: `Module level directives cause errors when bundled, "${e4}" in "${B(t2)}" was ignored.` }), this.start);
  }
  removeAnnotations(e4) {
    this.expression.removeAnnotations(e4);
  }
  render(e4, t2) {
    super.render(e4, t2), ";" !== e4.original[this.end - 1] && e4.appendLeft(this.end, ";");
  }
  shouldBeIncluded(e4) {
    return this.directive && "use strict" !== this.directive ? this.parent.type !== Ee : super.shouldBeIncluded(e4);
  }
  applyDeoptimizations() {
  }
}
class Gi extends bs {
  get deoptimizeBody() {
    return se(this.flags, 32768);
  }
  set deoptimizeBody(e4) {
    this.flags = ie(this.flags, 32768, e4);
  }
  get directlyIncluded() {
    return se(this.flags, 16384);
  }
  set directlyIncluded(e4) {
    this.flags = ie(this.flags, 16384, e4);
  }
  addImplicitReturnExpressionToScope() {
    const e4 = this.body[this.body.length - 1];
    e4 && "ReturnStatement" === e4.type || this.scope.addReturnExpression(le);
  }
  createScope(e4) {
    this.scope = this.parent.preventChildBlockScope ? e4 : new ji(e4);
  }
  hasEffects(e4) {
    if (this.deoptimizeBody)
      return true;
    for (const t2 of this.body) {
      if (e4.brokenFlow)
        break;
      if (t2.hasEffects(e4))
        return true;
    }
    return false;
  }
  include(e4, t2) {
    if (!this.deoptimizeBody || !this.directlyIncluded) {
      this.included = true, this.directlyIncluded = true, this.deoptimizeBody && (t2 = true);
      for (const n2 of this.body)
        (t2 || n2.shouldBeIncluded(e4)) && n2.include(e4, t2);
    }
  }
  initialise() {
    super.initialise();
    const e4 = this.body[0];
    this.deoptimizeBody = e4 instanceof Ui && "use asm" === e4.directive;
  }
  render(e4, t2) {
    this.body.length > 0 ? zi(this.body, e4, this.start + 1, this.end - 1, t2) : super.render(e4, t2);
  }
}
class Wi extends bs {
  constructor() {
    super(...arguments), this.declarationInit = null;
  }
  addExportedVariables(e4, t2) {
    this.argument.addExportedVariables(e4, t2);
  }
  declare(e4, t2) {
    return this.declarationInit = t2, this.argument.declare(e4, le);
  }
  deoptimizePath(e4) {
    0 === e4.length && this.argument.deoptimizePath(Y);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return e4.length > 0 || this.argument.hasEffectsOnInteractionAtPath(Y, t2, n2);
  }
  markDeclarationReached() {
    this.argument.markDeclarationReached();
  }
  applyDeoptimizations() {
    this.deoptimized = true, null !== this.declarationInit && (this.declarationInit.deoptimizePath([W, W]), this.scope.context.requestTreeshakingPass());
  }
}
class qi extends bs {
  constructor() {
    super(...arguments), this.objectEntity = null, this.parameterVariableValuesDeoptimized = false;
  }
  get async() {
    return se(this.flags, 256);
  }
  set async(e4) {
    this.flags = ie(this.flags, 256, e4);
  }
  get deoptimizedReturn() {
    return se(this.flags, 512);
  }
  set deoptimizedReturn(e4) {
    this.flags = ie(this.flags, 512, e4);
  }
  get generator() {
    return se(this.flags, 4194304);
  }
  set generator(e4) {
    this.flags = ie(this.flags, 4194304, e4);
  }
  updateParameterVariableValues(e4) {
    for (let t2 = 0; t2 < this.params.length; t2++) {
      const n2 = this.params[t2];
      if (!(n2 instanceof gi))
        continue;
      const s2 = n2.variable, i2 = e4[t2 + 1] ?? es;
      s2.updateKnownValue(i2);
    }
  }
  deoptimizeParameterVariableValues() {
    for (const e4 of this.params)
      if (e4 instanceof gi) {
        e4.variable.markReassigned();
      }
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    if (2 === e4.type) {
      const { parameters: t3 } = this.scope, { args: n3 } = e4;
      let s2 = false;
      for (let e5 = 0; e5 < n3.length - 1; e5++) {
        const i2 = this.params[e5], r2 = n3[e5 + 1];
        r2 instanceof Es && this.deoptimizeParameterVariableValues(), s2 || i2 instanceof Wi ? (s2 = true, r2.deoptimizePath(J)) : i2 instanceof gi ? (t3[e5][0].addEntityToBeDeoptimized(r2), this.addArgumentToBeDeoptimized(r2)) : i2 ? r2.deoptimizePath(J) : this.addArgumentToBeDeoptimized(r2);
      }
      this.updateParameterVariableValues(n3);
    } else
      this.getObjectEntity().deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizePath(e4) {
    if (this.getObjectEntity().deoptimizePath(e4), 1 === e4.length && e4[0] === W) {
      this.scope.getReturnExpression().deoptimizePath(J);
      for (const e5 of this.scope.parameters)
        for (const t2 of e5)
          t2.deoptimizePath(J), t2.markReassigned();
    }
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.getObjectEntity().getLiteralValueAtPath(e4, t2, n2);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return e4.length > 0 ? this.getObjectEntity().getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) : this.async ? (this.deoptimizedReturn || (this.deoptimizedReturn = true, this.scope.getReturnExpression().deoptimizePath(J), this.scope.context.requestTreeshakingPass()), ce) : [this.scope.getReturnExpression(), false];
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    if (e4.length > 0 || 2 !== t2.type)
      return this.getObjectEntity().hasEffectsOnInteractionAtPath(e4, t2, n2);
    if (this.annotationNoSideEffects)
      return false;
    if (this.async) {
      const { propertyReadSideEffects: e5 } = this.scope.context.options.treeshake, t3 = this.scope.getReturnExpression();
      if (t3.hasEffectsOnInteractionAtPath(["then"], pe, n2) || e5 && ("always" === e5 || t3.hasEffectsOnInteractionAtPath(["then"], de, n2)))
        return true;
    }
    for (const e5 of this.params)
      if (e5.hasEffects(n2))
        return true;
    return false;
  }
  onlyFunctionCallUsed() {
    let e4 = null;
    return "VariableDeclarator" === this.parent.type && (e4 = this.parent.id.variable ?? null), this.parent.type === ge && (e4 = this.parent.variable), (e4 == null ? void 0 : e4.getOnlyFunctionCallUsed()) ?? false;
  }
  include(e4, t2) {
    this.parameterVariableValuesDeoptimized || this.onlyFunctionCallUsed() || (this.parameterVariableValuesDeoptimized = true, this.deoptimizeParameterVariableValues()), this.deoptimized || this.applyDeoptimizations(), this.included = true;
    const { brokenFlow: n2 } = e4;
    e4.brokenFlow = false, this.body.include(e4, t2), e4.brokenFlow = n2;
  }
  includeCallArguments(e4, t2) {
    this.scope.includeCallArguments(e4, t2);
  }
  initialise() {
    super.initialise(), this.body instanceof Gi ? this.body.addImplicitReturnExpressionToScope() : this.scope.addReturnExpression(this.body), this.annotations && this.scope.context.options.treeshake.annotations && (this.annotationNoSideEffects = this.annotations.some((e4) => "noSideEffects" === e4.type));
  }
  parseNode(e4) {
    const { body: t2, params: n2 } = e4, { scope: s2 } = this, { bodyScope: i2, context: r2 } = s2, o2 = this.params = n2.map((e5) => new (r2.getNodeConstructor(e5.type))(this, s2).parseNode(e5));
    return s2.addParameterVariables(o2.map((e5) => e5.declare("parameter", le)), o2[o2.length - 1] instanceof Wi), this.body = new (r2.getNodeConstructor(t2.type))(this, i2).parseNode(t2), super.parseNode(e4);
  }
  addArgumentToBeDeoptimized(e4) {
  }
  applyDeoptimizations() {
  }
}
qi.prototype.preventChildBlockScope = true;
class Hi extends qi {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  get expression() {
    return se(this.flags, 8388608);
  }
  set expression(e4) {
    this.flags = ie(this.flags, 8388608, e4);
  }
  createScope(e4) {
    this.scope = new Di(e4, false);
  }
  hasEffects() {
    return this.deoptimized || this.applyDeoptimizations(), false;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    if (super.hasEffectsOnInteractionAtPath(e4, t2, n2))
      return true;
    if (this.annotationNoSideEffects)
      return false;
    if (2 === t2.type) {
      const { ignore: e5, brokenFlow: t3 } = n2;
      if (n2.ignore = { breaks: false, continues: false, labels: /* @__PURE__ */ new Set(), returnYield: true, this: false }, this.body.hasEffects(n2))
        return true;
      n2.ignore = e5, n2.brokenFlow = t3;
    }
    return false;
  }
  onlyFunctionCallUsed() {
    return this.parent.type === me && this.parent.callee === this || super.onlyFunctionCallUsed();
  }
  include(e4, t2) {
    super.include(e4, t2);
    for (const n2 of this.params)
      n2 instanceof gi || n2.include(e4, t2);
  }
  getObjectEntity() {
    return null !== this.objectEntity ? this.objectEntity : this.objectEntity = new Ps([], Ns);
  }
}
function Ki(e4, { exportNamesByVariable: t2, snippets: { _: n2, getObject: s2, getPropertyAccess: i2 } }, r2 = "") {
  if (1 === e4.length && 1 === t2.get(e4[0]).length) {
    const s3 = e4[0];
    return `exports(${JSON.stringify(t2.get(s3)[0])},${n2}${s3.getName(i2)}${r2})`;
  }
  {
    const n3 = [];
    for (const s3 of e4)
      for (const e5 of t2.get(s3))
        n3.push([e5, s3.getName(i2) + r2]);
    return `exports(${s2(n3, { lineBreakIndent: null })})`;
  }
}
function Yi(e4, t2, n2, s2, { exportNamesByVariable: i2, snippets: { _: r2 } }) {
  s2.prependRight(t2, `exports(${JSON.stringify(i2.get(e4)[0])},${r2}`), s2.appendLeft(n2, ")");
}
function Ji(e4, t2, n2, s2, i2, r2) {
  const { _: o2, getPropertyAccess: a2 } = r2.snippets;
  i2.appendLeft(n2, `,${o2}${Ki([e4], r2)},${o2}${e4.getName(a2)}`), s2 && (i2.prependRight(t2, "("), i2.appendLeft(n2, ")"));
}
class Xi extends bs {
  addExportedVariables(e4, t2) {
    for (const n2 of this.properties)
      "Property" === n2.type ? n2.value.addExportedVariables(e4, t2) : n2.argument.addExportedVariables(e4, t2);
  }
  declare(e4, t2) {
    const n2 = [];
    for (const s2 of this.properties)
      n2.push(...s2.declare(e4, t2));
    return n2;
  }
  deoptimizePath(e4) {
    if (0 === e4.length)
      for (const t2 of this.properties)
        t2.deoptimizePath(e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    for (const e5 of this.properties)
      if (e5.hasEffectsOnInteractionAtPath(Y, t2, n2))
        return true;
    return false;
  }
  markDeclarationReached() {
    for (const e4 of this.properties)
      e4.markDeclarationReached();
  }
}
class Zi extends bs {
  hasEffects(e4) {
    const { deoptimized: t2, left: n2, operator: s2, right: i2 } = this;
    return t2 || this.applyDeoptimizations(), i2.hasEffects(e4) || n2.hasEffectsAsAssignmentTarget(e4, "=" !== s2);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return this.right.hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  include(e4, t2) {
    const { deoptimized: n2, left: s2, right: i2, operator: r2 } = this;
    n2 || this.applyDeoptimizations(), this.included = true, (t2 || "=" !== r2 || s2.included || s2.hasEffectsAsAssignmentTarget(jn(), false)) && s2.includeAsAssignmentTarget(e4, t2, "=" !== r2), i2.include(e4, t2);
  }
  initialise() {
    if (super.initialise(), this.left instanceof gi) {
      const e4 = this.scope.variables.get(this.left.name);
      "const" === (e4 == null ? void 0 : e4.kind) && this.scope.context.error({ code: "CONST_REASSIGN", message: "Cannot reassign a variable declared with `const`" }, this.left.start);
    }
    this.left.setAssignedValue(this.right);
  }
  render(e4, t2, { preventASI: n2, renderedParentType: s2, renderedSurroundingElement: i2 } = Ae) {
    const { left: r2, right: o2, start: a2, end: l2, parent: c2 } = this;
    if (r2.included)
      r2.render(e4, t2), o2.render(e4, t2);
    else {
      const l3 = Bi(e4.original, _i(e4.original, "=", r2.end) + 1);
      e4.remove(a2, l3), n2 && Fi(e4, l3, o2.start), o2.render(e4, t2, { renderedParentType: s2 || c2.type, renderedSurroundingElement: i2 || c2.type });
    }
    if ("system" === t2.format)
      if (r2 instanceof gi) {
        const n3 = r2.variable, s3 = t2.exportNamesByVariable.get(n3);
        if (s3)
          return void (1 === s3.length ? Yi(n3, a2, l2, e4, t2) : Ji(n3, a2, l2, c2.type !== ye, e4, t2));
      } else {
        const n3 = [];
        if (r2.addExportedVariables(n3, t2.exportNamesByVariable), n3.length > 0)
          return void function(e5, t3, n4, s3, i3, r3) {
            const { _: o3, getDirectReturnIifeLeft: a3 } = r3.snippets;
            i3.prependRight(t3, a3(["v"], `${Ki(e5, r3)},${o3}v`, { needsArrowReturnParens: true, needsWrappedFunction: s3 })), i3.appendLeft(n4, ")");
          }(n3, a2, l2, i2 === ye, e4, t2);
      }
    r2.included && r2 instanceof Xi && (i2 === ye || i2 === fe) && (e4.appendRight(a2, "("), e4.prependLeft(l2, ")"));
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.left.deoptimizePath(Y), this.right.deoptimizePath(J), this.scope.context.requestTreeshakingPass();
  }
}
class Qi extends bs {
  addExportedVariables(e4, t2) {
    this.left.addExportedVariables(e4, t2);
  }
  declare(e4, t2) {
    return this.left.declare(e4, t2);
  }
  deoptimizePath(e4) {
    0 === e4.length && this.left.deoptimizePath(e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return e4.length > 0 || this.left.hasEffectsOnInteractionAtPath(Y, t2, n2);
  }
  markDeclarationReached() {
    this.left.markDeclarationReached();
  }
  render(e4, t2, { isShorthandProperty: n2 } = Ae) {
    this.left.render(e4, t2, { isShorthandProperty: n2 }), this.right.render(e4, t2);
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.left.deoptimizePath(Y), this.right.deoptimizePath(J), this.scope.context.requestTreeshakingPass();
  }
}
class er extends fi {
  constructor(e4) {
    super("arguments", null, le, e4, "other"), this.deoptimizedArguments = [];
  }
  addArgumentToBeDeoptimized(e4) {
    this.included ? e4.deoptimizePath(J) : this.deoptimizedArguments.push(e4);
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }) {
    return 0 !== t2 || e4.length > 1;
  }
  include() {
    super.include();
    for (const e4 of this.deoptimizedArguments)
      e4.deoptimizePath(J);
    this.deoptimizedArguments.length = 0;
  }
}
class tr extends Ai {
  constructor(e4) {
    super("this", null, e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return (n2.replacedVariableInits.get(this) || le).hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
}
class nr extends Di {
  constructor(e4) {
    const { context: t2 } = e4;
    super(e4, false), this.variables.set("arguments", this.argumentsVariable = new er(t2)), this.variables.set("this", this.thisVariable = new tr(t2));
  }
  findLexicalBoundary() {
    return this;
  }
  includeCallArguments(e4, t2) {
    if (super.includeCallArguments(e4, t2), this.argumentsVariable.included)
      for (const n2 of t2)
        n2.included || n2.include(e4, false);
  }
}
class sr extends qi {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  createScope(e4) {
    this.scope = new nr(e4), this.constructedEntity = new Ps(/* @__PURE__ */ Object.create(null), Ns), this.scope.thisVariable.addEntityToBeDeoptimized(this.constructedEntity);
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    super.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2), 2 === e4.type && 0 === t2.length && e4.args[0] && this.scope.thisVariable.addEntityToBeDeoptimized(e4.args[0]);
  }
  hasEffects(e4) {
    var _a3;
    return this.deoptimized || this.applyDeoptimizations(), !this.annotationNoSideEffects && !!((_a3 = this.id) == null ? void 0 : _a3.hasEffects(e4));
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    if (super.hasEffectsOnInteractionAtPath(e4, t2, n2))
      return true;
    if (this.annotationNoSideEffects)
      return false;
    if (2 === t2.type) {
      const e5 = n2.replacedVariableInits.get(this.scope.thisVariable);
      n2.replacedVariableInits.set(this.scope.thisVariable, t2.withNew ? this.constructedEntity : le);
      const { brokenFlow: s2, ignore: i2, replacedVariableInits: r2 } = n2;
      if (n2.ignore = { breaks: false, continues: false, labels: /* @__PURE__ */ new Set(), returnYield: true, this: t2.withNew }, this.body.hasEffects(n2))
        return true;
      n2.brokenFlow = s2, e5 ? r2.set(this.scope.thisVariable, e5) : r2.delete(this.scope.thisVariable), n2.ignore = i2;
    }
    return false;
  }
  include(e4, t2) {
    var _a3;
    super.include(e4, t2), (_a3 = this.id) == null ? void 0 : _a3.include();
    const n2 = this.scope.argumentsVariable.included;
    for (const s2 of this.params)
      s2 instanceof gi && !n2 || s2.include(e4, t2);
  }
  initialise() {
    var _a3;
    super.initialise(), (_a3 = this.id) == null ? void 0 : _a3.declare("function", this);
  }
  addArgumentToBeDeoptimized(e4) {
    this.scope.argumentsVariable.addArgumentToBeDeoptimized(e4);
  }
  getObjectEntity() {
    return null !== this.objectEntity ? this.objectEntity : this.objectEntity = new Ps([{ key: "prototype", kind: "init", property: new Ps([], Ns) }], Ns);
  }
}
class ir extends bs {
  hasEffects() {
    return this.deoptimized || this.applyDeoptimizations(), true;
  }
  include(e4, t2) {
    if (this.deoptimized || this.applyDeoptimizations(), !this.included) {
      this.included = true;
      e:
        if (!this.scope.context.usesTopLevelAwait) {
          let e5 = this.parent;
          do {
            if (e5 instanceof sr || e5 instanceof Hi)
              break e;
          } while (e5 = e5.parent);
          this.scope.context.usesTopLevelAwait = true;
        }
    }
    this.argument.include(e4, t2);
  }
}
const rr = { "!=": (e4, t2) => e4 != t2, "!==": (e4, t2) => e4 !== t2, "%": (e4, t2) => e4 % t2, "&": (e4, t2) => e4 & t2, "*": (e4, t2) => e4 * t2, "**": (e4, t2) => e4 ** t2, "+": (e4, t2) => e4 + t2, "-": (e4, t2) => e4 - t2, "/": (e4, t2) => e4 / t2, "<": (e4, t2) => e4 < t2, "<<": (e4, t2) => e4 << t2, "<=": (e4, t2) => e4 <= t2, "==": (e4, t2) => e4 == t2, "===": (e4, t2) => e4 === t2, ">": (e4, t2) => e4 > t2, ">=": (e4, t2) => e4 >= t2, ">>": (e4, t2) => e4 >> t2, ">>>": (e4, t2) => e4 >>> t2, "^": (e4, t2) => e4 ^ t2, "|": (e4, t2) => e4 | t2 };
class or extends bs {
  deoptimizeCache() {
  }
  getLiteralValueAtPath(e4, t2, n2) {
    if (e4.length > 0)
      return re;
    const s2 = this.left.getLiteralValueAtPath(Y, t2, n2);
    if ("symbol" == typeof s2)
      return re;
    const i2 = this.right.getLiteralValueAtPath(Y, t2, n2);
    if ("symbol" == typeof i2)
      return re;
    const r2 = rr[this.operator];
    return r2 ? r2(s2, i2) : re;
  }
  hasEffects(e4) {
    return "+" === this.operator && this.parent instanceof Ui && "" === this.left.getLiteralValueAtPath(Y, te, this) || super.hasEffects(e4);
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }) {
    return 0 !== t2 || e4.length > 1;
  }
  removeAnnotations(e4) {
    this.left.removeAnnotations(e4);
  }
  render(e4, t2, { renderedSurroundingElement: n2 } = Ae) {
    this.left.render(e4, t2, { renderedSurroundingElement: n2 }), this.right.render(e4, t2);
  }
}
class ar extends bs {
  hasEffects(e4) {
    if (this.label) {
      if (!e4.ignore.labels.has(this.label.name))
        return true;
      e4.includedLabels.add(this.label.name);
    } else {
      if (!e4.ignore.breaks)
        return true;
      e4.hasBreak = true;
    }
    return e4.brokenFlow = true, false;
  }
  include(e4) {
    this.included = true, this.label ? (this.label.include(), e4.includedLabels.add(this.label.name)) : e4.hasBreak = true, e4.brokenFlow = true;
  }
}
function lr(e4, t2, n2) {
  if (n2.arguments.length > 0)
    if (n2.arguments[n2.arguments.length - 1].included)
      for (const s2 of n2.arguments)
        s2.render(e4, t2);
    else {
      let s2 = n2.arguments.length - 2;
      for (; s2 >= 0 && !n2.arguments[s2].included; )
        s2--;
      if (s2 >= 0) {
        for (let i2 = 0; i2 <= s2; i2++)
          n2.arguments[i2].render(e4, t2);
        e4.remove(_i(e4.original, ",", n2.arguments[s2].end), n2.end - 1);
      } else
        e4.remove(_i(e4.original, "(", n2.callee.end) + 1, n2.end - 1);
    }
}
class cr extends bs {
  deoptimizeArgumentsOnInteractionAtPath() {
  }
  getLiteralValueAtPath(e4) {
    return e4.length > 0 || null === this.value && 110 !== this.scope.context.code.charCodeAt(this.start) || "bigint" == typeof this.value || 47 === this.scope.context.code.charCodeAt(this.start) ? re : this.value;
  }
  getReturnExpressionWhenCalledAtPath(e4) {
    return 1 !== e4.length ? ce : ms(this.members, e4[0]);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    switch (t2.type) {
      case 0:
        return e4.length > (null === this.value ? 0 : 1);
      case 1:
        return true;
      case 2:
        return !!(this.included && this.value instanceof RegExp && (this.value.global || this.value.sticky)) || (1 !== e4.length || fs(this.members, e4[0], t2, n2));
    }
  }
  initialise() {
    super.initialise(), this.members = function(e4) {
      if (e4 instanceof RegExp)
        return hs;
      switch (typeof e4) {
        case "boolean":
          return us;
        case "number":
          return ds;
        case "string":
          return ps;
      }
      return /* @__PURE__ */ Object.create(null);
    }(this.value);
  }
  parseNode(e4) {
    return this.value = e4.value, this.regex = e4.regex, super.parseNode(e4);
  }
  render(e4) {
    "string" == typeof this.value && e4.indentExclusionRanges.push([this.start + 1, this.end - 1]);
  }
}
function ur(e4) {
  return e4.computed ? function(e5) {
    if (e5 instanceof cr)
      return String(e5.value);
    return null;
  }(e4.property) : e4.property.name;
}
function dr(e4) {
  const t2 = e4.propertyKey, n2 = e4.object;
  if ("string" == typeof t2) {
    if (n2 instanceof gi)
      return [{ key: n2.name, pos: n2.start }, { key: t2, pos: e4.property.start }];
    if (n2 instanceof hr) {
      const s2 = dr(n2);
      return s2 && [...s2, { key: t2, pos: e4.property.start }];
    }
  }
  return null;
}
class hr extends bs {
  constructor() {
    super(...arguments), this.variable = null, this.expressionsToBeDeoptimized = [];
  }
  get computed() {
    return se(this.flags, 1024);
  }
  set computed(e4) {
    this.flags = ie(this.flags, 1024, e4);
  }
  get optional() {
    return se(this.flags, 128);
  }
  set optional(e4) {
    this.flags = ie(this.flags, 128, e4);
  }
  get assignmentDeoptimized() {
    return se(this.flags, 16);
  }
  set assignmentDeoptimized(e4) {
    this.flags = ie(this.flags, 16, e4);
  }
  get bound() {
    return se(this.flags, 32);
  }
  set bound(e4) {
    this.flags = ie(this.flags, 32, e4);
  }
  get isUndefined() {
    return se(this.flags, 64);
  }
  set isUndefined(e4) {
    this.flags = ie(this.flags, 64, e4);
  }
  bind() {
    this.bound = true;
    const e4 = dr(this), t2 = e4 && this.scope.findVariable(e4[0].key);
    if (t2 == null ? void 0 : t2.isNamespace) {
      const n2 = pr(t2, e4.slice(1), this.scope.context);
      n2 ? "undefined" === n2 ? this.isUndefined = true : (this.variable = n2, this.scope.addNamespaceMemberAccess(function(e5) {
        let t3 = e5[0].key;
        for (let n3 = 1; n3 < e5.length; n3++)
          t3 += "." + e5[n3].key;
        return t3;
      }(e4), n2)) : super.bind();
    } else
      super.bind();
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.variable ? this.variable.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) : this.isUndefined || (t2.length < 7 ? this.object.deoptimizeArgumentsOnInteractionAtPath(e4, [this.getPropertyKey(), ...t2], n2) : ue(e4));
  }
  deoptimizeCache() {
    const { expressionsToBeDeoptimized: e4, object: t2 } = this;
    this.expressionsToBeDeoptimized = we, this.propertyKey = W, t2.deoptimizePath(J);
    for (const t3 of e4)
      t3.deoptimizeCache();
  }
  deoptimizePath(e4) {
    if (0 === e4.length && this.disallowNamespaceReassignment(), this.variable)
      this.variable.deoptimizePath(e4);
    else if (!this.isUndefined && e4.length < 7) {
      const t2 = this.getPropertyKey();
      this.object.deoptimizePath([t2 === W ? q : t2, ...e4]);
    }
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.variable ? this.variable.getLiteralValueAtPath(e4, t2, n2) : this.isUndefined ? void 0 : this.propertyKey !== W && e4.length < 7 ? (this.expressionsToBeDeoptimized.push(n2), this.object.getLiteralValueAtPath([this.getPropertyKey(), ...e4], t2, n2)) : re;
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return this.variable ? this.variable.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) : this.isUndefined ? [es, false] : this.propertyKey !== W && e4.length < 7 ? (this.expressionsToBeDeoptimized.push(s2), this.object.getReturnExpressionWhenCalledAtPath([this.getPropertyKey(), ...e4], t2, n2, s2)) : ce;
  }
  hasEffects(e4) {
    return this.deoptimized || this.applyDeoptimizations(), this.property.hasEffects(e4) || this.object.hasEffects(e4) || this.hasAccessEffect(e4);
  }
  hasEffectsAsAssignmentTarget(e4, t2) {
    return t2 && !this.deoptimized && this.applyDeoptimizations(), this.assignmentDeoptimized || this.applyAssignmentDeoptimization(), this.property.hasEffects(e4) || this.object.hasEffects(e4) || t2 && this.hasAccessEffect(e4) || this.hasEffectsOnInteractionAtPath(Y, this.assignmentInteraction, e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return this.variable ? this.variable.hasEffectsOnInteractionAtPath(e4, t2, n2) : !!this.isUndefined || (!(e4.length < 7) || this.object.hasEffectsOnInteractionAtPath([this.getPropertyKey(), ...e4], t2, n2));
  }
  include(e4, t2) {
    this.deoptimized || this.applyDeoptimizations(), this.includeProperties(e4, t2);
  }
  includeAsAssignmentTarget(e4, t2, n2) {
    this.assignmentDeoptimized || this.applyAssignmentDeoptimization(), n2 ? this.include(e4, t2) : this.includeProperties(e4, t2);
  }
  includeCallArguments(e4, t2) {
    this.variable ? this.variable.includeCallArguments(e4, t2) : super.includeCallArguments(e4, t2);
  }
  initialise() {
    super.initialise(), this.propertyKey = ur(this), this.accessInteraction = { args: [this.object], type: 0 };
  }
  isSkippedAsOptional(e4) {
    var _a3, _b;
    return !this.variable && !this.isUndefined && (((_b = (_a3 = this.object).isSkippedAsOptional) == null ? void 0 : _b.call(_a3, e4)) || this.optional && null == this.object.getLiteralValueAtPath(Y, te, e4));
  }
  render(e4, t2, { renderedParentType: n2, isCalleeOfRenderedParent: s2, renderedSurroundingElement: i2 } = Ae) {
    if (this.variable || this.isUndefined) {
      const { snippets: { getPropertyAccess: i3 } } = t2;
      let r2 = this.variable ? this.variable.getName(i3) : "undefined";
      n2 && s2 && (r2 = "0, " + r2), e4.overwrite(this.start, this.end, r2, { contentOnly: true, storeName: true });
    } else
      n2 && s2 && e4.appendRight(this.start, "0, "), this.object.render(e4, t2, { renderedSurroundingElement: i2 }), this.property.render(e4, t2);
  }
  setAssignedValue(e4) {
    this.assignmentInteraction = { args: [this.object, e4], type: 1 };
  }
  applyDeoptimizations() {
    this.deoptimized = true;
    const { propertyReadSideEffects: e4 } = this.scope.context.options.treeshake;
    if (this.bound && e4 && !this.variable && !this.isUndefined) {
      const e5 = this.getPropertyKey();
      this.object.deoptimizeArgumentsOnInteractionAtPath(this.accessInteraction, [e5], te), this.scope.context.requestTreeshakingPass();
    }
    this.variable && (this.variable.addUsedPlace(this), this.scope.context.requestTreeshakingPass());
  }
  applyAssignmentDeoptimization() {
    this.assignmentDeoptimized = true;
    const { propertyReadSideEffects: e4 } = this.scope.context.options.treeshake;
    this.bound && e4 && !this.variable && !this.isUndefined && (this.object.deoptimizeArgumentsOnInteractionAtPath(this.assignmentInteraction, [this.getPropertyKey()], te), this.scope.context.requestTreeshakingPass());
  }
  disallowNamespaceReassignment() {
    if (this.object instanceof gi) {
      this.scope.findVariable(this.object.name).isNamespace && (this.variable && this.scope.context.includeVariableInModule(this.variable), this.scope.context.log(Le, Qt(this.object.name, this.scope.context.module.id), this.start));
    }
  }
  getPropertyKey() {
    if (null === this.propertyKey) {
      this.propertyKey = W;
      const e4 = this.property.getLiteralValueAtPath(Y, te, this);
      return this.propertyKey = e4 === K ? e4 : "symbol" == typeof e4 ? W : String(e4);
    }
    return this.propertyKey;
  }
  hasAccessEffect(e4) {
    const { propertyReadSideEffects: t2 } = this.scope.context.options.treeshake;
    return !(this.variable || this.isUndefined) && t2 && ("always" === t2 || this.object.hasEffectsOnInteractionAtPath([this.getPropertyKey()], this.accessInteraction, e4));
  }
  includeProperties(e4, t2) {
    this.included || (this.included = true, this.variable && this.scope.context.includeVariableInModule(this.variable)), this.object.include(e4, t2), this.property.include(e4, t2);
  }
}
function pr(e4, t2, n2) {
  if (0 === t2.length)
    return e4;
  if (!e4.isNamespace || e4 instanceof $e)
    return null;
  const s2 = t2[0].key, i2 = e4.context.traceExport(s2);
  if (!i2) {
    if (1 === t2.length) {
      const i3 = e4.context.fileName;
      return n2.log(Le, an(s2, n2.module.id, i3), t2[0].pos), "undefined";
    }
    return null;
  }
  return pr(i2, t2.slice(1), n2);
}
class fr extends bs {
  constructor() {
    super(...arguments), this.returnExpression = null, this.deoptimizableDependentExpressions = [], this.expressionsToBeDeoptimized = /* @__PURE__ */ new Set();
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    const { args: s2 } = e4, [i2, r2] = this.getReturnExpression(n2);
    if (r2)
      return;
    const o2 = s2.filter((e5) => !!e5 && e5 !== le);
    if (0 !== o2.length)
      if (i2 === le)
        for (const e5 of o2)
          e5.deoptimizePath(J);
      else
        n2.withTrackedEntityAtPath(t2, i2, () => {
          for (const e5 of o2)
            this.expressionsToBeDeoptimized.add(e5);
          i2.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
        }, null);
  }
  deoptimizeCache() {
    var _a3;
    if (((_a3 = this.returnExpression) == null ? void 0 : _a3[0]) !== le) {
      this.returnExpression = ce;
      const { deoptimizableDependentExpressions: e4, expressionsToBeDeoptimized: t2 } = this;
      this.expressionsToBeDeoptimized = ve, this.deoptimizableDependentExpressions = we;
      for (const t3 of e4)
        t3.deoptimizeCache();
      for (const e5 of t2)
        e5.deoptimizePath(J);
    }
  }
  deoptimizePath(e4) {
    if (0 === e4.length || this.scope.context.deoptimizationTracker.trackEntityAtPathAndGetIfTracked(e4, this))
      return;
    const [t2] = this.getReturnExpression();
    t2 !== le && t2.deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    const [s2] = this.getReturnExpression(t2);
    return s2 === le ? re : t2.withTrackedEntityAtPath(e4, s2, () => (this.deoptimizableDependentExpressions.push(n2), s2.getLiteralValueAtPath(e4, t2, n2)), re);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    const i2 = this.getReturnExpression(n2);
    return i2[0] === le ? i2 : n2.withTrackedEntityAtPath(e4, i2, () => {
      this.deoptimizableDependentExpressions.push(s2);
      const [r2, o2] = i2[0].getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2);
      return [r2, o2 || i2[1]];
    }, ce);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    const { type: s2 } = t2;
    if (2 === s2) {
      const { args: s3, withNew: i3 } = t2;
      if ((i3 ? n2.instantiated : n2.called).trackEntityAtPathAndGetIfTracked(e4, s3, this))
        return false;
    } else if ((1 === s2 ? n2.assigned : n2.accessed).trackEntityAtPathAndGetIfTracked(e4, this))
      return false;
    const [i2, r2] = this.getReturnExpression();
    return (1 === s2 || !r2) && i2.hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
}
class mr extends fr {
  get optional() {
    return se(this.flags, 128);
  }
  set optional(e4) {
    this.flags = ie(this.flags, 128, e4);
  }
  bind() {
    if (super.bind(), this.callee instanceof gi) {
      this.scope.findVariable(this.callee.name).isNamespace && this.scope.context.log(Le, Yt(this.callee.name), this.start), "eval" === this.callee.name && this.scope.context.log(Le, { code: "EVAL", id: e4 = this.scope.context.module.id, message: `Use of eval in "${B(e4)}" is strongly discouraged as it poses security risks and may cause issues with minification.`, url: Ke("troubleshooting/#avoiding-eval") }, this.start);
    }
    var e4;
    this.interaction = { args: [this.callee instanceof hr && !this.callee.variable ? this.callee.object : null, ...this.arguments], type: 2, withNew: false };
  }
  hasEffects(e4) {
    this.deoptimized || this.applyDeoptimizations();
    for (const t2 of this.arguments)
      if (t2.hasEffects(e4))
        return true;
    return !this.annotationPure && (this.callee.hasEffects(e4) || this.callee.hasEffectsOnInteractionAtPath(Y, this.interaction, e4));
  }
  include(e4, t2) {
    this.deoptimized || this.applyDeoptimizations(), t2 ? (super.include(e4, t2), t2 === ys && this.callee instanceof gi && this.callee.variable && this.callee.variable.markCalledFromTryStatement()) : (this.included = true, this.callee.include(e4, false)), this.callee.includeCallArguments(e4, this.arguments);
  }
  initialise() {
    super.initialise(), this.annotations && this.scope.context.options.treeshake.annotations && (this.annotationPure = this.annotations.some((e4) => "pure" === e4.type));
  }
  isSkippedAsOptional(e4) {
    var _a3, _b;
    return ((_b = (_a3 = this.callee).isSkippedAsOptional) == null ? void 0 : _b.call(_a3, e4)) || this.optional && null == this.callee.getLiteralValueAtPath(Y, te, e4);
  }
  render(e4, t2, { renderedSurroundingElement: n2 } = Ae) {
    this.callee.render(e4, t2, { isCalleeOfRenderedParent: true, renderedSurroundingElement: n2 }), lr(e4, t2, this);
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.callee.deoptimizeArgumentsOnInteractionAtPath(this.interaction, Y, te), this.scope.context.requestTreeshakingPass();
  }
  getReturnExpression(e4 = te) {
    return null === this.returnExpression ? (this.returnExpression = ce, this.returnExpression = this.callee.getReturnExpressionWhenCalledAtPath(Y, this.interaction, e4, this)) : this.returnExpression;
  }
}
class gr extends bs {
  createScope(e4) {
    this.scope = new Oi(e4, true);
  }
  parseNode(e4) {
    const { body: t2, param: n2, type: s2 } = e4;
    return this.type = s2, n2 && (this.param = new (this.scope.context.getNodeConstructor(n2.type))(this, this.scope).parseNode(n2), this.param.declare("parameter", le)), this.body = new Gi(this, this.scope.bodyScope).parseNode(t2), super.parseNode(e4);
  }
}
gr.prototype.preventChildBlockScope = true;
class yr extends bs {
  deoptimizeCache() {
  }
  getLiteralValueAtPath(e4, t2, n2) {
    if (!this.expression.isSkippedAsOptional(n2))
      return this.expression.getLiteralValueAtPath(e4, t2, n2);
  }
  hasEffects(e4) {
    return !this.expression.isSkippedAsOptional(this) && this.expression.hasEffects(e4);
  }
  removeAnnotations(e4) {
    this.expression.removeAnnotations(e4);
  }
}
class br extends ki {
  constructor(e4, t2) {
    const { context: n2 } = e4;
    super(e4, n2), this.variables.set("this", this.thisVariable = new fi("this", null, t2, n2, "other")), this.instanceScope = new ki(this, n2), this.instanceScope.variables.set("this", new tr(n2));
  }
  findLexicalBoundary() {
    return this;
  }
}
class Er extends bs {
  createScope(e4) {
    this.scope = new br(e4, this.parent);
  }
  include(e4, t2) {
    this.included = true, this.scope.context.includeVariableInModule(this.scope.thisVariable);
    for (const n2 of this.body)
      n2.include(e4, t2);
  }
  parseNode(e4) {
    const t2 = this.body = [];
    for (const n2 of e4.body)
      t2.push(new (this.scope.context.getNodeConstructor(n2.type))(this, n2.static ? this.scope : this.scope.instanceScope).parseNode(n2));
    return super.parseNode(e4);
  }
  applyDeoptimizations() {
  }
}
class xr extends bs {
  constructor() {
    super(...arguments), this.accessedValue = null;
  }
  get computed() {
    return se(this.flags, 1024);
  }
  set computed(e4) {
    this.flags = ie(this.flags, 1024, e4);
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    return 0 === e4.type && "get" === this.kind && 0 === t2.length || 1 === e4.type && "set" === this.kind && 0 === t2.length ? this.value.deoptimizeArgumentsOnInteractionAtPath({ args: e4.args, type: 2, withNew: false }, Y, n2) : void this.getAccessedValue()[0].deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizeCache() {
  }
  deoptimizePath(e4) {
    this.getAccessedValue()[0].deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.getAccessedValue()[0].getLiteralValueAtPath(e4, t2, n2);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return this.getAccessedValue()[0].getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2);
  }
  hasEffects(e4) {
    return this.key.hasEffects(e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return "get" === this.kind && 0 === t2.type && 0 === e4.length || "set" === this.kind && 1 === t2.type ? this.value.hasEffectsOnInteractionAtPath(Y, { args: t2.args, type: 2, withNew: false }, n2) : this.getAccessedValue()[0].hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  applyDeoptimizations() {
  }
  getAccessedValue() {
    return null === this.accessedValue ? "get" === this.kind ? (this.accessedValue = ce, this.accessedValue = this.value.getReturnExpressionWhenCalledAtPath(Y, pe, te, this)) : this.accessedValue = [this.value, false] : this.accessedValue;
  }
}
class $r extends xr {
  applyDeoptimizations() {
  }
}
class Ar extends ae {
  constructor(e4, t2) {
    super(), this.object = e4, this.key = t2;
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.object.deoptimizeArgumentsOnInteractionAtPath(e4, [this.key, ...t2], n2);
  }
  deoptimizePath(e4) {
    this.object.deoptimizePath([this.key, ...e4]);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.object.getLiteralValueAtPath([this.key, ...e4], t2, n2);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return this.object.getReturnExpressionWhenCalledAtPath([this.key, ...e4], t2, n2, s2);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return this.object.hasEffectsOnInteractionAtPath([this.key, ...e4], t2, n2);
  }
}
class Sr extends bs {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  createScope(e4) {
    this.scope = new ki(e4, e4.context);
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.getObjectEntity().deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizeCache() {
    this.getObjectEntity().deoptimizeAllProperties();
  }
  deoptimizePath(e4) {
    this.getObjectEntity().deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.getObjectEntity().getLiteralValueAtPath(e4, t2, n2);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return this.getObjectEntity().getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2);
  }
  hasEffects(e4) {
    var _a3, _b;
    this.deoptimized || this.applyDeoptimizations();
    const t2 = ((_a3 = this.superClass) == null ? void 0 : _a3.hasEffects(e4)) || this.body.hasEffects(e4);
    return (_b = this.id) == null ? void 0 : _b.markDeclarationReached(), t2 || super.hasEffects(e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    var _a3;
    return 2 === t2.type && 0 === e4.length ? !t2.withNew || (null === this.classConstructor ? (_a3 = this.superClass) == null ? void 0 : _a3.hasEffectsOnInteractionAtPath(e4, t2, n2) : this.classConstructor.hasEffectsOnInteractionAtPath(e4, t2, n2)) || false : this.getObjectEntity().hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  include(e4, t2) {
    var _a3;
    this.deoptimized || this.applyDeoptimizations(), this.included = true, (_a3 = this.superClass) == null ? void 0 : _a3.include(e4, t2), this.body.include(e4, t2), this.id && (this.id.markDeclarationReached(), this.id.include());
  }
  initialise() {
    var _a3;
    super.initialise(), (_a3 = this.id) == null ? void 0 : _a3.declare("class", this);
    for (const e4 of this.body.body)
      if (e4 instanceof $r && "constructor" === e4.kind)
        return void (this.classConstructor = e4);
    this.classConstructor = null;
  }
  applyDeoptimizations() {
    this.deoptimized = true;
    for (const e4 of this.body.body)
      e4.static || e4 instanceof $r && "constructor" === e4.kind || e4.deoptimizePath(J);
    this.scope.context.requestTreeshakingPass();
  }
  getObjectEntity() {
    if (null !== this.objectEntity)
      return this.objectEntity;
    const e4 = [], t2 = [];
    for (const n2 of this.body.body) {
      const s2 = n2.static ? e4 : t2, i2 = n2.kind;
      if (s2 === t2 && !i2)
        continue;
      const r2 = "set" === i2 || "get" === i2 ? i2 : "init";
      let o2;
      if (n2.computed) {
        const e5 = n2.key.getLiteralValueAtPath(Y, te, this);
        if ("symbol" == typeof e5) {
          s2.push({ key: W, kind: r2, property: n2 });
          continue;
        }
        o2 = String(e5);
      } else
        o2 = n2.key instanceof gi ? n2.key.name : String(n2.key.value);
      s2.push({ key: o2, kind: r2, property: n2 });
    }
    return e4.unshift({ key: "prototype", kind: "init", property: new Ps(t2, this.superClass ? new Ar(this.superClass, "prototype") : Ns) }), this.objectEntity = new Ps(e4, this.superClass || Ns);
  }
}
class wr extends Sr {
  initialise() {
    super.initialise(), null !== this.id && (this.id.variable.isId = true);
  }
  parseNode(e4) {
    return null !== e4.id && (this.id = new gi(this, this.scope.parent).parseNode(e4.id)), super.parseNode(e4);
  }
  render(e4, t2) {
    var _a3;
    const { exportNamesByVariable: n2, format: s2, snippets: { _: i2, getPropertyAccess: r2 } } = t2;
    if (this.id) {
      const { variable: o2, name: a2 } = this.id;
      "system" === s2 && n2.has(o2) && e4.appendLeft(this.end, `${i2}${Ki([o2], t2)};`);
      const l2 = o2.getName(r2);
      if (l2 !== a2)
        return (_a3 = this.superClass) == null ? void 0 : _a3.render(e4, t2), this.body.render(e4, { ...t2, useOriginalName: (e5) => e5 === o2 }), e4.prependRight(this.start, `let ${l2}${i2}=${i2}`), void e4.prependLeft(this.end, ";");
    }
    super.render(e4, t2);
  }
  applyDeoptimizations() {
    super.applyDeoptimizations();
    const { id: e4, scope: t2 } = this;
    if (e4) {
      const { name: n2, variable: s2 } = e4;
      for (const e5 of t2.accessedOutsideVariables.values())
        e5 !== s2 && e5.forbidName(n2);
    }
  }
}
class vr extends Sr {
  render(e4, t2, { renderedSurroundingElement: n2 } = Ae) {
    super.render(e4, t2), n2 === ye && (e4.appendRight(this.start, "("), e4.prependLeft(this.end, ")"));
  }
}
class Pr extends ae {
  constructor(e4) {
    super(), this.expressions = e4;
  }
  deoptimizePath(e4) {
    for (const t2 of this.expressions)
      t2.deoptimizePath(e4);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return [new Pr(this.expressions.map((i2) => i2.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2)[0])), false];
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    for (const s2 of this.expressions)
      if (s2.hasEffectsOnInteractionAtPath(e4, t2, n2))
        return true;
    return false;
  }
}
class Ir extends bs {
  constructor() {
    super(...arguments), this.expressionsToBeDeoptimized = [], this.usedBranch = null;
  }
  get isBranchResolutionAnalysed() {
    return se(this.flags, 65536);
  }
  set isBranchResolutionAnalysed(e4) {
    this.flags = ie(this.flags, 65536, e4);
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.consequent.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2), this.alternate.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizeCache() {
    if (null !== this.usedBranch) {
      const e4 = this.usedBranch === this.consequent ? this.alternate : this.consequent;
      this.usedBranch = null, e4.deoptimizePath(J);
      const { expressionsToBeDeoptimized: t2 } = this;
      this.expressionsToBeDeoptimized = we;
      for (const e5 of t2)
        e5.deoptimizeCache();
    }
  }
  deoptimizePath(e4) {
    const t2 = this.getUsedBranch();
    t2 ? t2.deoptimizePath(e4) : (this.consequent.deoptimizePath(e4), this.alternate.deoptimizePath(e4));
  }
  getLiteralValueAtPath(e4, t2, n2) {
    const s2 = this.getUsedBranch();
    return s2 ? (this.expressionsToBeDeoptimized.push(n2), s2.getLiteralValueAtPath(e4, t2, n2)) : re;
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    const i2 = this.getUsedBranch();
    return i2 ? (this.expressionsToBeDeoptimized.push(s2), i2.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2)) : [new Pr([this.consequent.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2)[0], this.alternate.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2)[0]]), false];
  }
  hasEffects(e4) {
    if (this.test.hasEffects(e4))
      return true;
    const t2 = this.getUsedBranch();
    return t2 ? t2.hasEffects(e4) : this.consequent.hasEffects(e4) || this.alternate.hasEffects(e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    const s2 = this.getUsedBranch();
    return s2 ? s2.hasEffectsOnInteractionAtPath(e4, t2, n2) : this.consequent.hasEffectsOnInteractionAtPath(e4, t2, n2) || this.alternate.hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  include(e4, t2) {
    this.included = true;
    const n2 = this.getUsedBranch();
    t2 || this.test.shouldBeIncluded(e4) || null === n2 ? (this.test.include(e4, t2), this.consequent.include(e4, t2), this.alternate.include(e4, t2)) : n2.include(e4, t2);
  }
  includeCallArguments(e4, t2) {
    const n2 = this.getUsedBranch();
    n2 ? n2.includeCallArguments(e4, t2) : (this.consequent.includeCallArguments(e4, t2), this.alternate.includeCallArguments(e4, t2));
  }
  removeAnnotations(e4) {
    this.test.removeAnnotations(e4);
  }
  render(e4, t2, { isCalleeOfRenderedParent: n2, preventASI: s2, renderedParentType: i2, renderedSurroundingElement: r2 } = Ae) {
    const o2 = this.getUsedBranch();
    if (this.test.included)
      this.test.render(e4, t2, { renderedSurroundingElement: r2 }), this.consequent.render(e4, t2), this.alternate.render(e4, t2);
    else {
      const a2 = _i(e4.original, ":", this.consequent.end), l2 = Bi(e4.original, (this.consequent.included ? _i(e4.original, "?", this.test.end) : a2) + 1);
      s2 && Fi(e4, l2, o2.start), e4.remove(this.start, l2), this.consequent.included && e4.remove(a2, this.end), this.test.removeAnnotations(e4), o2.render(e4, t2, { isCalleeOfRenderedParent: n2, preventASI: true, renderedParentType: i2 || this.parent.type, renderedSurroundingElement: r2 || this.parent.type });
    }
  }
  getUsedBranch() {
    if (this.isBranchResolutionAnalysed)
      return this.usedBranch;
    this.isBranchResolutionAnalysed = true;
    const e4 = this.test.getLiteralValueAtPath(Y, te, this);
    return "symbol" == typeof e4 ? null : this.usedBranch = e4 ? this.consequent : this.alternate;
  }
}
class kr extends bs {
  hasEffects(e4) {
    if (this.label) {
      if (!e4.ignore.labels.has(this.label.name))
        return true;
      e4.includedLabels.add(this.label.name);
    } else {
      if (!e4.ignore.continues)
        return true;
      e4.hasContinue = true;
    }
    return e4.brokenFlow = true, false;
  }
  include(e4) {
    this.included = true, this.label ? (this.label.include(), e4.includedLabels.add(this.label.name)) : e4.hasContinue = true, e4.brokenFlow = true;
  }
}
class Nr extends bs {
  hasEffects() {
    return true;
  }
}
function Cr(e4, t2) {
  const { brokenFlow: n2, hasBreak: s2, hasContinue: i2, ignore: r2 } = e4, { breaks: o2, continues: a2 } = r2;
  return r2.breaks = true, r2.continues = true, e4.hasBreak = false, e4.hasContinue = false, !!t2.hasEffects(e4) || (r2.breaks = o2, r2.continues = a2, e4.hasBreak = s2, e4.hasContinue = i2, e4.brokenFlow = n2, false);
}
function Or(e4, t2, n2) {
  const { brokenFlow: s2, hasBreak: i2, hasContinue: r2 } = e4;
  e4.hasBreak = false, e4.hasContinue = false, t2.include(e4, n2, { asSingleStatement: true }), e4.hasBreak = i2, e4.hasContinue = r2, e4.brokenFlow = s2;
}
class Dr extends bs {
  hasEffects(e4) {
    return !!this.test.hasEffects(e4) || Cr(e4, this.body);
  }
  include(e4, t2) {
    this.included = true, this.test.include(e4, t2), Or(e4, this.body, t2);
  }
}
class Mr extends bs {
  hasEffects() {
    return false;
  }
}
class Rr extends bs {
  hasEffects() {
    return false;
  }
  initialise() {
    super.initialise(), this.scope.context.addExport(this);
  }
  render(e4, t2, n2) {
    e4.remove(n2.start, n2.end);
  }
  applyDeoptimizations() {
  }
}
Rr.prototype.needsBoundaries = true;
class _r extends sr {
  initialise() {
    super.initialise(), null !== this.id && (this.id.variable.isId = true);
  }
  onlyFunctionCallUsed() {
    var _a3;
    return ((_a3 = this.id) == null ? void 0 : _a3.variable.getOnlyFunctionCallUsed()) ?? super.onlyFunctionCallUsed();
  }
  parseNode(e4) {
    return null !== e4.id && (this.id = new gi(this, this.scope.parent).parseNode(e4.id)), super.parseNode(e4);
  }
}
class Lr extends bs {
  include(e4, t2) {
    super.include(e4, t2), t2 && this.scope.context.includeVariableInModule(this.variable);
  }
  initialise() {
    super.initialise();
    const e4 = this.declaration;
    this.declarationName = e4.id && e4.id.name || this.declaration.name, this.variable = this.scope.addExportDefaultDeclaration(this.declarationName || this.scope.context.getModuleName(), this, this.scope.context), this.scope.context.addExport(this);
  }
  removeAnnotations(e4) {
    this.declaration.removeAnnotations(e4);
  }
  render(e4, t2, n2) {
    const { start: s2, end: i2 } = n2, r2 = function(e5, t3) {
      return Bi(e5, _i(e5, "default", t3) + 7);
    }(e4.original, this.start);
    if (this.declaration instanceof _r)
      this.renderNamedDeclaration(e4, r2, null === this.declaration.id ? function(e5, t3) {
        const n3 = _i(e5, "function", t3) + 8;
        e5 = e5.slice(n3, _i(e5, "(", n3));
        const s3 = _i(e5, "*");
        return -1 === s3 ? n3 : n3 + s3 + 1;
      }(e4.original, r2) : null, t2);
    else if (this.declaration instanceof wr)
      this.renderNamedDeclaration(e4, r2, null === this.declaration.id ? _i(e4.original, "class", s2) + 5 : null, t2);
    else {
      if (this.variable.getOriginalVariable() !== this.variable)
        return void Mi(this, e4, s2, i2);
      if (!this.variable.included)
        return e4.remove(this.start, r2), this.declaration.render(e4, t2, { renderedSurroundingElement: ye }), void (";" !== e4.original[this.end - 1] && e4.appendLeft(this.end, ";"));
      this.renderVariableDeclaration(e4, r2, t2);
    }
    this.declaration.render(e4, t2);
  }
  applyDeoptimizations() {
  }
  renderNamedDeclaration(e4, t2, n2, s2) {
    const { exportNamesByVariable: i2, format: r2, snippets: { getPropertyAccess: o2 } } = s2, a2 = this.variable.getName(o2);
    e4.remove(this.start, t2), null !== n2 && e4.appendLeft(n2, ` ${a2}`), "system" === r2 && this.declaration instanceof wr && i2.has(this.variable) && e4.appendLeft(this.end, ` ${Ki([this.variable], s2)};`);
  }
  renderVariableDeclaration(e4, t2, { format: n2, exportNamesByVariable: s2, snippets: { cnst: i2, getPropertyAccess: r2 } }) {
    const o2 = 59 === e4.original.charCodeAt(this.end - 1), a2 = "system" === n2 && s2.get(this.variable);
    a2 ? (e4.overwrite(this.start, t2, `${i2} ${this.variable.getName(r2)} = exports(${JSON.stringify(a2[0])}, `), e4.appendRight(o2 ? this.end - 1 : this.end, ")" + (o2 ? "" : ";"))) : (e4.overwrite(this.start, t2, `${i2} ${this.variable.getName(r2)} = `), o2 || e4.appendLeft(this.end, ";"));
  }
}
Lr.prototype.needsBoundaries = true;
class Br extends bs {
  bind() {
    var _a3;
    (_a3 = this.declaration) == null ? void 0 : _a3.bind();
  }
  hasEffects(e4) {
    var _a3;
    return !!((_a3 = this.declaration) == null ? void 0 : _a3.hasEffects(e4));
  }
  initialise() {
    super.initialise(), this.scope.context.addExport(this);
  }
  removeAnnotations(e4) {
    var _a3;
    (_a3 = this.declaration) == null ? void 0 : _a3.removeAnnotations(e4);
  }
  render(e4, t2, n2) {
    const { start: s2, end: i2 } = n2;
    null === this.declaration ? e4.remove(s2, i2) : (e4.remove(this.start, this.declaration.start), this.declaration.render(e4, t2, { end: i2, start: s2 }));
  }
  applyDeoptimizations() {
  }
}
Br.prototype.needsBoundaries = true;
class Tr extends bs {
  applyDeoptimizations() {
  }
}
class zr extends bs {
  createScope(e4) {
    this.scope = new ji(e4);
  }
  hasEffects(e4) {
    const { body: t2, deoptimized: n2, left: s2, right: i2 } = this;
    return n2 || this.applyDeoptimizations(), !(!s2.hasEffectsAsAssignmentTarget(e4, false) && !i2.hasEffects(e4)) || Cr(e4, t2);
  }
  include(e4, t2) {
    const { body: n2, deoptimized: s2, left: i2, right: r2 } = this;
    s2 || this.applyDeoptimizations(), this.included = true, i2.includeAsAssignmentTarget(e4, t2 || true, false), r2.include(e4, t2), Or(e4, n2, t2);
  }
  initialise() {
    super.initialise(), this.left.setAssignedValue(le);
  }
  render(e4, t2) {
    this.left.render(e4, t2, Ri), this.right.render(e4, t2, Ri), 110 === e4.original.charCodeAt(this.right.start - 1) && e4.prependLeft(this.right.start, " "), this.body.render(e4, t2);
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.left.deoptimizePath(Y), this.scope.context.requestTreeshakingPass();
  }
}
class Vr extends bs {
  get await() {
    return se(this.flags, 131072);
  }
  set await(e4) {
    this.flags = ie(this.flags, 131072, e4);
  }
  createScope(e4) {
    this.scope = new ji(e4);
  }
  hasEffects() {
    return this.deoptimized || this.applyDeoptimizations(), true;
  }
  include(e4, t2) {
    const { body: n2, deoptimized: s2, left: i2, right: r2 } = this;
    s2 || this.applyDeoptimizations(), this.included = true, i2.includeAsAssignmentTarget(e4, t2 || true, false), r2.include(e4, t2), Or(e4, n2, t2);
  }
  initialise() {
    super.initialise(), this.left.setAssignedValue(le);
  }
  render(e4, t2) {
    this.left.render(e4, t2, Ri), this.right.render(e4, t2, Ri), 102 === e4.original.charCodeAt(this.right.start - 1) && e4.prependLeft(this.right.start, " "), this.body.render(e4, t2);
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.left.deoptimizePath(Y), this.right.deoptimizePath(J), this.scope.context.requestTreeshakingPass();
  }
}
class Fr extends bs {
  createScope(e4) {
    this.scope = new ji(e4);
  }
  hasEffects(e4) {
    var _a3, _b, _c2;
    return !!(((_a3 = this.init) == null ? void 0 : _a3.hasEffects(e4)) || ((_b = this.test) == null ? void 0 : _b.hasEffects(e4)) || ((_c2 = this.update) == null ? void 0 : _c2.hasEffects(e4))) || Cr(e4, this.body);
  }
  include(e4, t2) {
    var _a3, _b, _c2;
    this.included = true, (_a3 = this.init) == null ? void 0 : _a3.include(e4, t2, { asSingleStatement: true }), (_b = this.test) == null ? void 0 : _b.include(e4, t2), (_c2 = this.update) == null ? void 0 : _c2.include(e4, t2), Or(e4, this.body, t2);
  }
  render(e4, t2) {
    var _a3, _b, _c2;
    (_a3 = this.init) == null ? void 0 : _a3.render(e4, t2, Ri), (_b = this.test) == null ? void 0 : _b.render(e4, t2, Ri), (_c2 = this.update) == null ? void 0 : _c2.render(e4, t2, Ri), this.body.render(e4, t2);
  }
}
class jr extends sr {
  createScope(e4) {
    super.createScope(this.idScope = new ki(e4, e4.context));
  }
  parseNode(e4) {
    return null !== e4.id && (this.id = new gi(this, this.idScope).parseNode(e4.id)), super.parseNode(e4);
  }
  onlyFunctionCallUsed() {
    return this.parent.type === me && this.parent.callee === this && (null === this.id || this.id.variable.getOnlyFunctionCallUsed()) || super.onlyFunctionCallUsed();
  }
  render(e4, t2, { renderedSurroundingElement: n2 } = Ae) {
    super.render(e4, t2), n2 === ye && (e4.appendRight(this.start, "("), e4.prependLeft(this.end, ")"));
  }
}
class Ur extends ji {
  constructor() {
    super(...arguments), this.hoistedDeclarations = [];
  }
  addDeclaration(e4, t2, n2, s2) {
    return this.hoistedDeclarations.push(e4), super.addDeclaration(e4, t2, n2, s2);
  }
}
const Gr = Symbol("unset");
class Wr extends bs {
  constructor() {
    super(...arguments), this.testValue = Gr;
  }
  deoptimizeCache() {
    this.testValue = re;
  }
  hasEffects(e4) {
    var _a3;
    if (this.test.hasEffects(e4))
      return true;
    const t2 = this.getTestValue();
    if ("symbol" == typeof t2) {
      const { brokenFlow: t3 } = e4;
      if (this.consequent.hasEffects(e4))
        return true;
      const n2 = e4.brokenFlow;
      return e4.brokenFlow = t3, null === this.alternate ? false : !!this.alternate.hasEffects(e4) || (e4.brokenFlow = e4.brokenFlow && n2, false);
    }
    return t2 ? this.consequent.hasEffects(e4) : !!((_a3 = this.alternate) == null ? void 0 : _a3.hasEffects(e4));
  }
  include(e4, t2) {
    if (this.included = true, t2)
      this.includeRecursively(t2, e4);
    else {
      const t3 = this.getTestValue();
      "symbol" == typeof t3 ? this.includeUnknownTest(e4) : this.includeKnownTest(e4, t3);
    }
  }
  parseNode(e4) {
    return this.consequent = new (this.scope.context.getNodeConstructor(e4.consequent.type))(this, this.consequentScope = new Ur(this.scope)).parseNode(e4.consequent), e4.alternate && (this.alternate = new (this.scope.context.getNodeConstructor(e4.alternate.type))(this, this.alternateScope = new Ur(this.scope)).parseNode(e4.alternate)), super.parseNode(e4);
  }
  render(e4, t2) {
    const { snippets: { getPropertyAccess: n2 } } = t2, s2 = this.getTestValue(), i2 = [], r2 = this.test.included, o2 = !this.scope.context.options.treeshake;
    r2 ? this.test.render(e4, t2) : e4.remove(this.start, this.consequent.start), this.consequent.included && (o2 || "symbol" == typeof s2 || s2) ? this.consequent.render(e4, t2) : (e4.overwrite(this.consequent.start, this.consequent.end, r2 ? ";" : ""), i2.push(...this.consequentScope.hoistedDeclarations)), this.alternate && (!this.alternate.included || !o2 && "symbol" != typeof s2 && s2 ? (r2 && this.shouldKeepAlternateBranch() ? e4.overwrite(this.alternate.start, this.end, ";") : e4.remove(this.consequent.end, this.end), i2.push(...this.alternateScope.hoistedDeclarations)) : (r2 ? 101 === e4.original.charCodeAt(this.alternate.start - 1) && e4.prependLeft(this.alternate.start, " ") : e4.remove(this.consequent.end, this.alternate.start), this.alternate.render(e4, t2))), this.renderHoistedDeclarations(i2, e4, n2);
  }
  applyDeoptimizations() {
  }
  getTestValue() {
    return this.testValue === Gr ? this.testValue = this.test.getLiteralValueAtPath(Y, te, this) : this.testValue;
  }
  includeKnownTest(e4, t2) {
    var _a3;
    this.test.shouldBeIncluded(e4) && this.test.include(e4, false), t2 && this.consequent.shouldBeIncluded(e4) && this.consequent.include(e4, false, { asSingleStatement: true }), !t2 && ((_a3 = this.alternate) == null ? void 0 : _a3.shouldBeIncluded(e4)) && this.alternate.include(e4, false, { asSingleStatement: true });
  }
  includeRecursively(e4, t2) {
    var _a3;
    this.test.include(t2, e4), this.consequent.include(t2, e4), (_a3 = this.alternate) == null ? void 0 : _a3.include(t2, e4);
  }
  includeUnknownTest(e4) {
    var _a3;
    this.test.include(e4, false);
    const { brokenFlow: t2 } = e4;
    let n2 = false;
    this.consequent.shouldBeIncluded(e4) && (this.consequent.include(e4, false, { asSingleStatement: true }), n2 = e4.brokenFlow, e4.brokenFlow = t2), ((_a3 = this.alternate) == null ? void 0 : _a3.shouldBeIncluded(e4)) && (this.alternate.include(e4, false, { asSingleStatement: true }), e4.brokenFlow = e4.brokenFlow && n2);
  }
  renderHoistedDeclarations(e4, t2, n2) {
    const s2 = [...new Set(e4.map((e5) => {
      const t3 = e5.variable;
      return t3.included ? t3.getName(n2) : "";
    }))].filter(Boolean).join(", ");
    if (s2) {
      const e5 = this.parent.type, n3 = e5 !== Ee && "BlockStatement" !== e5;
      t2.prependRight(this.start, `${n3 ? "{ " : ""}var ${s2}; `), n3 && t2.appendLeft(this.end, " }");
    }
  }
  shouldKeepAlternateBranch() {
    let e4 = this.parent;
    do {
      if (e4 instanceof Wr && e4.alternate)
        return true;
      if (e4 instanceof Gi)
        return false;
      e4 = e4.parent;
    } while (e4);
    return false;
  }
}
class qr extends bs {
}
class Hr extends bs {
  bind() {
  }
  hasEffects() {
    return false;
  }
  initialise() {
    super.initialise(), this.scope.context.addImport(this);
  }
  render(e4, t2, n2) {
    e4.remove(n2.start, n2.end);
  }
  applyDeoptimizations() {
  }
}
Hr.prototype.needsBoundaries = true;
class Kr extends bs {
  applyDeoptimizations() {
  }
}
const Yr = "_interopDefault", Jr = "_interopDefaultCompat", Xr = "_interopNamespace", Zr = "_interopNamespaceCompat", Qr = "_interopNamespaceDefault", eo = "_interopNamespaceDefaultOnly", to = "_mergeNamespaces", no = "_documentCurrentScript", so = { auto: Yr, compat: Jr, default: null, defaultOnly: null, esModule: null }, io = (e4, t2) => "esModule" === e4 || t2 && ("auto" === e4 || "compat" === e4), ro = { auto: Xr, compat: Zr, default: Qr, defaultOnly: eo, esModule: null }, oo = (e4, t2) => "esModule" !== e4 && io(e4, t2), ao = (e4, t2, n2, s2, i2, r2, o2) => {
  const a2 = new Set(e4);
  for (const e5 of Ao)
    t2.has(e5) && a2.add(e5);
  return Ao.map((e5) => a2.has(e5) ? lo[e5](n2, s2, i2, r2, o2, a2) : "").join("");
}, lo = { [no]: (e4, { _: t2, n: n2 }) => `var${t2}${no}${t2}=${t2}typeof${t2}document${t2}!==${t2}'undefined'${t2}?${t2}document.currentScript${t2}:${t2}null;${n2}`, [Jr](e4, t2, n2) {
  const { _: s2, getDirectReturnFunction: i2, n: r2 } = t2, [o2, a2] = i2(["e"], { functionReturn: true, lineBreakIndent: null, name: Jr });
  return `${o2}${ho(t2)}${s2}?${s2}${n2 ? co(t2) : uo(t2)}${a2}${r2}${r2}`;
}, [Yr](e4, t2, n2) {
  const { _: s2, getDirectReturnFunction: i2, n: r2 } = t2, [o2, a2] = i2(["e"], { functionReturn: true, lineBreakIndent: null, name: Yr });
  return `${o2}e${s2}&&${s2}e.__esModule${s2}?${s2}${n2 ? co(t2) : uo(t2)}${a2}${r2}${r2}`;
}, [Zr](e4, t2, n2, s2, i2, r2) {
  const { _: o2, getDirectReturnFunction: a2, n: l2 } = t2;
  if (r2.has(Qr)) {
    const [e5, n3] = a2(["e"], { functionReturn: true, lineBreakIndent: null, name: Zr });
    return `${e5}${ho(t2)}${o2}?${o2}e${o2}:${o2}${Qr}(e)${n3}${l2}${l2}`;
  }
  return `function ${Zr}(e)${o2}{${l2}${e4}if${o2}(${ho(t2)})${o2}return e;${l2}` + po(e4, e4, t2, n2, s2, i2) + `}${l2}${l2}`;
}, [eo](e4, t2, n2, s2, i2) {
  const { getDirectReturnFunction: r2, getObject: o2, n: a2, _: l2 } = t2, [c2, u2] = r2(["e"], { functionReturn: true, lineBreakIndent: null, name: eo });
  return `${c2}${xo(s2, $o(i2, o2([[null, `__proto__:${l2}null`], ["default", "e"]], { lineBreakIndent: null }), t2))}${u2}${a2}${a2}`;
}, [Qr](e4, t2, n2, s2, i2) {
  const { _: r2, n: o2 } = t2;
  return `function ${Qr}(e)${r2}{${o2}` + po(e4, e4, t2, n2, s2, i2) + `}${o2}${o2}`;
}, [Xr](e4, t2, n2, s2, i2, r2) {
  const { _: o2, getDirectReturnFunction: a2, n: l2 } = t2;
  if (r2.has(Qr)) {
    const [e5, t3] = a2(["e"], { functionReturn: true, lineBreakIndent: null, name: Xr });
    return `${e5}e${o2}&&${o2}e.__esModule${o2}?${o2}e${o2}:${o2}${Qr}(e)${t3}${l2}${l2}`;
  }
  return `function ${Xr}(e)${o2}{${l2}${e4}if${o2}(e${o2}&&${o2}e.__esModule)${o2}return e;${l2}` + po(e4, e4, t2, n2, s2, i2) + `}${l2}${l2}`;
}, [to](e4, t2, n2, s2, i2) {
  const { _: r2, cnst: o2, n: a2 } = t2, l2 = "var" === o2 && n2;
  return `function ${to}(n, m)${r2}{${a2}${e4}${mo(`{${a2}${e4}${e4}${e4}if${r2}(k${r2}!==${r2}'default'${r2}&&${r2}!(k in n))${r2}{${a2}` + (n2 ? l2 ? yo : bo : Eo)(e4, e4 + e4 + e4 + e4, t2) + `${e4}${e4}${e4}}${a2}${e4}${e4}}`, l2, e4, t2)}${a2}${e4}return ${xo(s2, $o(i2, "n", t2))};${a2}}${a2}${a2}`;
} }, co = ({ _: e4, getObject: t2 }) => `e${e4}:${e4}${t2([["default", "e"]], { lineBreakIndent: null })}`, uo = ({ _: e4, getPropertyAccess: t2 }) => `e${t2("default")}${e4}:${e4}e`, ho = ({ _: e4 }) => `e${e4}&&${e4}typeof e${e4}===${e4}'object'${e4}&&${e4}'default'${e4}in e`, po = (e4, t2, n2, s2, i2, r2) => {
  const { _: o2, cnst: a2, getObject: l2, getPropertyAccess: c2, n: u2, s: d2 } = n2, h2 = `{${u2}` + (s2 ? go : Eo)(e4, t2 + e4 + e4, n2) + `${t2}${e4}}`;
  return `${t2}${a2} n${o2}=${o2}Object.create(null${r2 ? `,${o2}{${o2}[Symbol.toStringTag]:${o2}${So(l2)}${o2}}` : ""});${u2}${t2}if${o2}(e)${o2}{${u2}${t2}${e4}${fo(h2, !s2, n2)}${u2}${t2}}${u2}${t2}n${c2("default")}${o2}=${o2}e;${u2}${t2}return ${xo(i2, "n")}${d2}${u2}`;
}, fo = (e4, t2, { _: n2, cnst: s2, getFunctionIntro: i2, s: r2 }) => "var" !== s2 || t2 ? `for${n2}(${s2} k in e)${n2}${e4}` : `Object.keys(e).forEach(${i2(["k"], { isAsync: false, name: null })}${e4})${r2}`, mo = (e4, t2, n2, { _: s2, cnst: i2, getDirectReturnFunction: r2, getFunctionIntro: o2, n: a2 }) => {
  if (t2) {
    const [t3, i3] = r2(["e"], { functionReturn: false, lineBreakIndent: { base: n2, t: n2 }, name: null });
    return `m.forEach(${t3}e${s2}&&${s2}typeof e${s2}!==${s2}'string'${s2}&&${s2}!Array.isArray(e)${s2}&&${s2}Object.keys(e).forEach(${o2(["k"], { isAsync: false, name: null })}${e4})${i3});`;
  }
  return `for${s2}(var i${s2}=${s2}0;${s2}i${s2}<${s2}m.length;${s2}i++)${s2}{${a2}${n2}${n2}${i2} e${s2}=${s2}m[i];${a2}${n2}${n2}if${s2}(typeof e${s2}!==${s2}'string'${s2}&&${s2}!Array.isArray(e))${s2}{${s2}for${s2}(${i2} k in e)${s2}${e4}${s2}}${a2}${n2}}`;
}, go = (e4, t2, n2) => {
  const { _: s2, n: i2 } = n2;
  return `${t2}if${s2}(k${s2}!==${s2}'default')${s2}{${i2}` + yo(e4, t2 + e4, n2) + `${t2}}${i2}`;
}, yo = (e4, t2, { _: n2, cnst: s2, getDirectReturnFunction: i2, n: r2 }) => {
  const [o2, a2] = i2([], { functionReturn: true, lineBreakIndent: null, name: null });
  return `${t2}${s2} d${n2}=${n2}Object.getOwnPropertyDescriptor(e,${n2}k);${r2}${t2}Object.defineProperty(n,${n2}k,${n2}d.get${n2}?${n2}d${n2}:${n2}{${r2}${t2}${e4}enumerable:${n2}true,${r2}${t2}${e4}get:${n2}${o2}e[k]${a2}${r2}${t2}});${r2}`;
}, bo = (e4, t2, { _: n2, cnst: s2, getDirectReturnFunction: i2, n: r2 }) => {
  const [o2, a2] = i2([], { functionReturn: true, lineBreakIndent: null, name: null });
  return `${t2}${s2} d${n2}=${n2}Object.getOwnPropertyDescriptor(e,${n2}k);${r2}${t2}if${n2}(d)${n2}{${r2}${t2}${e4}Object.defineProperty(n,${n2}k,${n2}d.get${n2}?${n2}d${n2}:${n2}{${r2}${t2}${e4}${e4}enumerable:${n2}true,${r2}${t2}${e4}${e4}get:${n2}${o2}e[k]${a2}${r2}${t2}${e4}});${r2}${t2}}${r2}`;
}, Eo = (e4, t2, { _: n2, n: s2 }) => `${t2}n[k]${n2}=${n2}e[k];${s2}`, xo = (e4, t2) => e4 ? `Object.freeze(${t2})` : t2, $o = (e4, t2, { _: n2, getObject: s2 }) => e4 ? `Object.defineProperty(${t2},${n2}Symbol.toStringTag,${n2}${So(s2)})` : t2, Ao = Object.keys(lo);
function So(e4) {
  return e4([["value", "'Module'"]], { lineBreakIndent: null });
}
function wo(e4, t2) {
  return null !== e4.renderBaseName && t2.has(e4) && e4.isReassigned;
}
class vo extends bs {
  declareDeclarator(e4, t2) {
    this.isUsingDeclaration = t2, this.id.declare(e4, this.init || es);
  }
  deoptimizePath(e4) {
    this.id.deoptimizePath(e4);
  }
  hasEffects(e4) {
    var _a3;
    this.deoptimized || this.applyDeoptimizations();
    const t2 = (_a3 = this.init) == null ? void 0 : _a3.hasEffects(e4);
    return this.id.markDeclarationReached(), t2 || this.id.hasEffects(e4) || this.isUsingDeclaration;
  }
  include(e4, t2) {
    const { deoptimized: n2, id: s2, init: i2 } = this;
    n2 || this.applyDeoptimizations(), this.included = true, i2 == null ? void 0 : i2.include(e4, t2), s2.markDeclarationReached(), (t2 || s2.shouldBeIncluded(e4)) && s2.include(e4, t2);
  }
  removeAnnotations(e4) {
    var _a3;
    (_a3 = this.init) == null ? void 0 : _a3.removeAnnotations(e4);
  }
  render(e4, t2) {
    const { exportNamesByVariable: n2, snippets: { _: s2, getPropertyAccess: i2 } } = t2, { end: r2, id: o2, init: a2, start: l2 } = this, c2 = o2.included || this.isUsingDeclaration;
    if (c2)
      o2.render(e4, t2);
    else {
      const t3 = _i(e4.original, "=", o2.end);
      e4.remove(l2, Bi(e4.original, t3 + 1));
    }
    if (a2) {
      if (o2 instanceof gi && a2 instanceof vr && !a2.id) {
        o2.variable.getName(i2) !== o2.name && e4.appendLeft(a2.start + 5, ` ${o2.name}`);
      }
      a2.render(e4, t2, c2 ? Ae : { renderedSurroundingElement: ye });
    } else
      o2 instanceof gi && wo(o2.variable, n2) && e4.appendLeft(r2, `${s2}=${s2}void 0`);
  }
  applyDeoptimizations() {
    this.deoptimized = true;
    const { id: e4, init: t2 } = this;
    if (t2 && e4 instanceof gi && t2 instanceof vr && !t2.id) {
      const { name: n2, variable: s2 } = e4;
      for (const e5 of t2.scope.accessedOutsideVariables.values())
        e5 !== s2 && e5.forbidName(n2);
    }
  }
}
class Po extends bs {
  constructor() {
    super(...arguments), this.inlineNamespace = null, this.attributes = null, this.mechanism = null, this.namespaceExportName = void 0, this.resolution = null, this.resolutionString = null;
  }
  bind() {
    this.source.bind();
  }
  getDeterministicImportedNames() {
    const e4 = this.parent;
    if (e4 instanceof Ui)
      return we;
    if (e4 instanceof ir) {
      const t2 = e4.parent;
      if (t2 instanceof Ui)
        return we;
      if (t2 instanceof vo) {
        const e5 = t2.id;
        return e5 instanceof Xi ? No(e5) : void 0;
      }
      if (t2 instanceof hr) {
        const e5 = t2.property;
        if (!t2.computed && e5 instanceof gi)
          return [e5.name];
      }
    } else if (e4 instanceof hr) {
      const t2 = e4.parent, n2 = e4.property;
      if (!(t2 instanceof mr && n2 instanceof gi))
        return;
      const s2 = n2.name;
      if (t2.parent instanceof Ui && ["catch", "finally"].includes(s2))
        return we;
      if ("then" !== s2)
        return;
      if (0 === t2.arguments.length)
        return we;
      const i2 = t2.arguments[0];
      if (1 !== t2.arguments.length || !(i2 instanceof Hi || i2 instanceof jr))
        return;
      if (0 === i2.params.length)
        return we;
      const r2 = i2.params[0];
      return 1 === i2.params.length && r2 instanceof Xi ? No(r2) : void 0;
    }
  }
  hasEffects() {
    return true;
  }
  include(e4, t2) {
    this.included || (this.included = true, this.scope.context.includeDynamicImport(this), this.scope.addAccessedDynamicImport(this)), this.source.include(e4, t2);
  }
  initialise() {
    super.initialise(), this.scope.context.addDynamicImport(this);
  }
  parseNode(e4) {
    return this.sourceAstNode = e4.source, super.parseNode(e4);
  }
  render(e4, t2) {
    const { snippets: { _: n2, getDirectReturnFunction: s2, getObject: i2, getPropertyAccess: r2 } } = t2;
    if (this.inlineNamespace) {
      const [t3, n3] = s2([], { functionReturn: true, lineBreakIndent: null, name: null });
      e4.overwrite(this.start, this.end, `Promise.resolve().then(${t3}${this.inlineNamespace.getName(r2)}${n3})`);
    } else {
      if (this.mechanism && (e4.overwrite(this.start, _i(e4.original, "(", this.start + 6) + 1, this.mechanism.left), e4.overwrite(this.end - 1, this.end, this.mechanism.right)), this.resolutionString) {
        if (e4.overwrite(this.source.start, this.source.end, this.resolutionString), this.namespaceExportName) {
          const [t3, n3] = s2(["n"], { functionReturn: true, lineBreakIndent: null, name: null });
          e4.prependLeft(this.end, `.then(${t3}n.${this.namespaceExportName}${n3})`);
        }
      } else
        this.source.render(e4, t2);
      true !== this.attributes && (this.options && e4.overwrite(this.source.end, this.end - 1, "", { contentOnly: true }), this.attributes && e4.appendLeft(this.end - 1, `,${n2}${i2([["assert", this.attributes]], { lineBreakIndent: null })}`));
    }
  }
  setExternalResolution(e4, t2, n2, s2, i2, r2, o2, a2, l2) {
    const { format: c2 } = n2;
    this.inlineNamespace = null, this.resolution = t2, this.resolutionString = o2, this.namespaceExportName = a2, this.attributes = l2;
    const u2 = [...ko[c2] || []];
    let d2;
    ({ helper: d2, mechanism: this.mechanism } = this.getDynamicImportMechanismAndHelper(t2, e4, n2, s2, i2)), d2 && u2.push(d2), u2.length > 0 && this.scope.addAccessedGlobals(u2, r2);
  }
  setInternalResolution(e4) {
    this.inlineNamespace = e4;
  }
  applyDeoptimizations() {
  }
  getDynamicImportMechanismAndHelper(e4, t2, { compact: n2, dynamicImportInCjs: s2, format: i2, generatedCode: { arrowFunctions: r2 }, interop: o2 }, { _: a2, getDirectReturnFunction: l2, getDirectReturnIifeLeft: c2 }, u2) {
    const d2 = u2.hookFirstSync("renderDynamicImport", [{ customResolution: "string" == typeof this.resolution ? this.resolution : null, format: i2, moduleId: this.scope.context.module.id, targetModuleId: this.resolution && "string" != typeof this.resolution ? this.resolution.id : null }]);
    if (d2)
      return { helper: null, mechanism: d2 };
    const h2 = !this.resolution || "string" == typeof this.resolution;
    switch (i2) {
      case "cjs": {
        if (s2 && (!e4 || "string" == typeof e4 || e4 instanceof En))
          return { helper: null, mechanism: null };
        const n3 = Io(e4, t2, o2);
        let i3 = "require(", a3 = ")";
        n3 && (i3 = `/*#__PURE__*/${n3}(${i3}`, a3 += ")");
        const [u3, d3] = l2([], { functionReturn: true, lineBreakIndent: null, name: null });
        return i3 = `Promise.resolve().then(${u3}${i3}`, a3 += `${d3})`, !r2 && h2 && (i3 = c2(["t"], `${i3}t${a3}`, { needsArrowReturnParens: false, needsWrappedFunction: true }), a3 = ")"), { helper: n3, mechanism: { left: i3, right: a3 } };
      }
      case "amd": {
        const s3 = n2 ? "c" : "resolve", i3 = n2 ? "e" : "reject", u3 = Io(e4, t2, o2), [d3, p2] = l2(["m"], { functionReturn: false, lineBreakIndent: null, name: null }), f2 = u3 ? `${d3}${s3}(/*#__PURE__*/${u3}(m))${p2}` : s3, [m2, g2] = l2([s3, i3], { functionReturn: false, lineBreakIndent: null, name: null });
        let y2 = `new Promise(${m2}require([`, b2 = `],${a2}${f2},${a2}${i3})${g2})`;
        return !r2 && h2 && (y2 = c2(["t"], `${y2}t${b2}`, { needsArrowReturnParens: false, needsWrappedFunction: true }), b2 = ")"), { helper: u3, mechanism: { left: y2, right: b2 } };
      }
      case "system":
        return { helper: null, mechanism: { left: "module.import(", right: ")" } };
    }
    return { helper: null, mechanism: null };
  }
}
function Io(e4, t2, n2) {
  return "external" === t2 ? ro[n2(e4 instanceof En ? e4.id : null)] : "default" === t2 ? eo : null;
}
const ko = { amd: ["require"], cjs: ["require"], system: ["module"] };
function No(e4) {
  const t2 = [];
  for (const n2 of e4.properties) {
    if ("RestElement" === n2.type || n2.computed || "Identifier" !== n2.key.type)
      return;
    t2.push(n2.key.name);
  }
  return t2;
}
class Co extends bs {
  applyDeoptimizations() {
  }
}
class Oo extends bs {
  applyDeoptimizations() {
  }
}
class Do extends bs {
  hasEffects(e4) {
    const { brokenFlow: t2, includedLabels: n2 } = e4;
    e4.ignore.labels.add(this.label.name), e4.includedLabels = /* @__PURE__ */ new Set();
    let s2 = false;
    return this.body.hasEffects(e4) ? s2 = true : (e4.ignore.labels.delete(this.label.name), e4.includedLabels.has(this.label.name) && (e4.includedLabels.delete(this.label.name), e4.brokenFlow = t2)), e4.includedLabels = /* @__PURE__ */ new Set([...n2, ...e4.includedLabels]), s2;
  }
  include(e4, t2) {
    this.included = true;
    const { brokenFlow: n2, includedLabels: s2 } = e4;
    e4.includedLabels = /* @__PURE__ */ new Set(), this.body.include(e4, t2), (t2 || e4.includedLabels.has(this.label.name)) && (this.label.include(), e4.includedLabels.delete(this.label.name), e4.brokenFlow = n2), e4.includedLabels = /* @__PURE__ */ new Set([...s2, ...e4.includedLabels]);
  }
  render(e4, t2) {
    this.label.included ? this.label.render(e4, t2) : e4.remove(this.start, Bi(e4.original, _i(e4.original, ":", this.label.end) + 1)), this.body.render(e4, t2);
  }
}
class Mo extends bs {
  constructor() {
    super(...arguments), this.expressionsToBeDeoptimized = [], this.usedBranch = null;
  }
  get isBranchResolutionAnalysed() {
    return se(this.flags, 65536);
  }
  set isBranchResolutionAnalysed(e4) {
    this.flags = ie(this.flags, 65536, e4);
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.left.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2), this.right.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizeCache() {
    if (this.usedBranch) {
      const e4 = this.usedBranch === this.left ? this.right : this.left;
      this.usedBranch = null, e4.deoptimizePath(J);
      const { scope: { context: t2 }, expressionsToBeDeoptimized: n2 } = this;
      this.expressionsToBeDeoptimized = we;
      for (const e5 of n2)
        e5.deoptimizeCache();
      t2.requestTreeshakingPass();
    }
  }
  deoptimizePath(e4) {
    const t2 = this.getUsedBranch();
    t2 ? t2.deoptimizePath(e4) : (this.left.deoptimizePath(e4), this.right.deoptimizePath(e4));
  }
  getLiteralValueAtPath(e4, t2, n2) {
    const s2 = this.getUsedBranch();
    return s2 ? (this.expressionsToBeDeoptimized.push(n2), s2.getLiteralValueAtPath(e4, t2, n2)) : re;
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    const i2 = this.getUsedBranch();
    return i2 ? (this.expressionsToBeDeoptimized.push(s2), i2.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2)) : [new Pr([this.left.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2)[0], this.right.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2)[0]]), false];
  }
  hasEffects(e4) {
    return !!this.left.hasEffects(e4) || this.getUsedBranch() !== this.left && this.right.hasEffects(e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    const s2 = this.getUsedBranch();
    return s2 ? s2.hasEffectsOnInteractionAtPath(e4, t2, n2) : this.left.hasEffectsOnInteractionAtPath(e4, t2, n2) || this.right.hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  include(e4, t2) {
    this.included = true;
    const n2 = this.getUsedBranch();
    t2 || n2 === this.right && this.left.shouldBeIncluded(e4) || !n2 ? (this.left.include(e4, t2), this.right.include(e4, t2)) : n2.include(e4, t2);
  }
  removeAnnotations(e4) {
    this.left.removeAnnotations(e4);
  }
  render(e4, t2, { isCalleeOfRenderedParent: n2, preventASI: s2, renderedParentType: i2, renderedSurroundingElement: r2 } = Ae) {
    if (this.left.included && this.right.included)
      this.left.render(e4, t2, { preventASI: s2, renderedSurroundingElement: r2 }), this.right.render(e4, t2);
    else {
      const o2 = _i(e4.original, this.operator, this.left.end);
      if (this.right.included) {
        const t3 = Bi(e4.original, o2 + 2);
        e4.remove(this.start, t3), s2 && Fi(e4, t3, this.right.start), this.left.removeAnnotations(e4);
      } else
        e4.remove(o2, this.end);
      this.getUsedBranch().render(e4, t2, { isCalleeOfRenderedParent: n2, preventASI: s2, renderedParentType: i2 || this.parent.type, renderedSurroundingElement: r2 || this.parent.type });
    }
  }
  getUsedBranch() {
    if (!this.isBranchResolutionAnalysed) {
      this.isBranchResolutionAnalysed = true;
      const e4 = this.left.getLiteralValueAtPath(Y, te, this);
      if ("symbol" == typeof e4)
        return null;
      this.usedBranch = "||" === this.operator && e4 || "&&" === this.operator && !e4 || "??" === this.operator && null != e4 ? this.left : this.right;
    }
    return this.usedBranch;
  }
}
const Ro = "ROLLUP_FILE_URL_", _o = "import";
class Lo extends bs {
  constructor() {
    super(...arguments), this.metaProperty = null, this.preliminaryChunkId = null, this.referenceId = null;
  }
  getReferencedFileName(e4) {
    const { meta: { name: t2 }, metaProperty: n2 } = this;
    return t2 === _o && (n2 == null ? void 0 : n2.startsWith(Ro)) ? e4.getFileName(n2.slice(16)) : null;
  }
  hasEffects() {
    return false;
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }) {
    return e4.length > 1 || 0 !== t2;
  }
  include() {
    if (!this.included && (this.included = true, this.meta.name === _o)) {
      this.scope.context.addImportMeta(this);
      const e4 = this.parent, t2 = this.metaProperty = e4 instanceof hr && "string" == typeof e4.propertyKey ? e4.propertyKey : null;
      (t2 == null ? void 0 : t2.startsWith(Ro)) && (this.referenceId = t2.slice(16));
    }
  }
  render(e4, t2) {
    var _a3;
    const { format: n2, pluginDriver: s2, snippets: i2 } = t2, { scope: { context: { module: r2 } }, meta: { name: o2 }, metaProperty: a2, parent: l2, preliminaryChunkId: c2, referenceId: u2, start: d2, end: h2 } = this, { id: p2 } = r2;
    if (o2 !== _o)
      return;
    const f2 = c2;
    if (u2) {
      const t3 = s2.getFileName(u2), i3 = P(C(k(f2), t3)), r3 = s2.hookFirstSync("resolveFileUrl", [{ chunkId: f2, fileName: t3, format: n2, moduleId: p2, referenceId: u2, relativePath: i3 }]) || qo[n2](i3);
      return void e4.overwrite(l2.start, l2.end, r3, { contentOnly: true });
    }
    let m2 = s2.hookFirstSync("resolveImportMeta", [a2, { chunkId: f2, format: n2, moduleId: p2 }]);
    m2 || (m2 = (_a3 = Ho[n2]) == null ? void 0 : _a3.call(Ho, a2, { chunkId: f2, snippets: i2 }), t2.accessedDocumentCurrentScript || (t2.accessedDocumentCurrentScript = Bo.includes(n2) && "undefined" !== m2)), "string" == typeof m2 && (l2 instanceof hr ? e4.overwrite(l2.start, l2.end, m2, { contentOnly: true }) : e4.overwrite(d2, h2, m2, { contentOnly: true }));
  }
  setResolution(e4, t2, n2) {
    var _a3;
    this.preliminaryChunkId = n2;
    const s2 = (((_a3 = this.metaProperty) == null ? void 0 : _a3.startsWith(Ro)) ? zo : To)[e4];
    s2.length > 0 && this.scope.addAccessedGlobals(s2, t2);
  }
}
const Bo = ["cjs", "iife", "umd"], To = { amd: ["document", "module", "URL"], cjs: ["document", "require", "URL", no], es: [], iife: ["document", "URL", no], system: ["module"], umd: ["document", "require", "URL", no] }, zo = { amd: ["document", "require", "URL"], cjs: ["document", "require", "URL"], es: [], iife: ["document", "URL"], system: ["module", "URL"], umd: ["document", "require", "URL"] }, Vo = (e4, t2 = "URL") => `new ${t2}(${e4}).href`, Fo = (e4, t2 = false) => Vo(`'${_(e4)}', ${t2 ? "typeof document === 'undefined' ? location.href : " : ""}document.currentScript && document.currentScript.src || document.baseURI`), jo = (e4) => (t2, { chunkId: n2 }) => {
  const s2 = e4(n2);
  return null === t2 ? `({ url: ${s2} })` : "url" === t2 ? s2 : "undefined";
}, Uo = (e4) => `require('u' + 'rl').pathToFileURL(${e4}).href`, Go = (e4) => Uo(`__dirname + '/${_(e4)}'`), Wo = (e4, t2 = false) => `${t2 ? "typeof document === 'undefined' ? location.href : " : ""}(${no} && ${no}.src || new URL('${_(e4)}', document.baseURI).href)`, qo = { amd: (e4) => ("." !== e4[0] && (e4 = "./" + e4), Vo(`require.toUrl('${_(e4)}'), document.baseURI`)), cjs: (e4) => `(typeof document === 'undefined' ? ${Go(e4)} : ${Fo(e4)})`, es: (e4) => Vo(`'${_(e4)}', import.meta.url`), iife: (e4) => Fo(e4), system: (e4) => Vo(`'${_(e4)}', module.meta.url`), umd: (e4) => `(typeof document === 'undefined' && typeof location === 'undefined' ? ${Go(e4)} : ${Fo(e4, true)})` }, Ho = { amd: jo(() => Vo("module.uri, document.baseURI")), cjs: jo((e4) => `(typeof document === 'undefined' ? ${Uo("__filename")} : ${Wo(e4)})`), iife: jo((e4) => Wo(e4)), system: (e4, { snippets: { getPropertyAccess: t2 } }) => null === e4 ? "module.meta" : `module.meta${t2(e4)}`, umd: jo((e4) => `(typeof document === 'undefined' && typeof location === 'undefined' ? ${Uo("__filename")} : ${Wo(e4, true)})`) };
class Ko extends bs {
  hasEffects(e4) {
    this.deoptimized || this.applyDeoptimizations();
    for (const t2 of this.arguments)
      if (t2.hasEffects(e4))
        return true;
    return !this.annotationPure && (this.callee.hasEffects(e4) || this.callee.hasEffectsOnInteractionAtPath(Y, this.interaction, e4));
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }) {
    return e4.length > 0 || 0 !== t2;
  }
  include(e4, t2) {
    this.deoptimized || this.applyDeoptimizations(), t2 ? super.include(e4, t2) : (this.included = true, this.callee.include(e4, false)), this.callee.includeCallArguments(e4, this.arguments);
  }
  initialise() {
    super.initialise(), this.interaction = { args: [null, ...this.arguments], type: 2, withNew: true }, this.annotations && this.scope.context.options.treeshake.annotations && (this.annotationPure = this.annotations.some((e4) => "pure" === e4.type));
  }
  render(e4, t2) {
    this.callee.render(e4, t2), lr(e4, t2, this);
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.callee.deoptimizeArgumentsOnInteractionAtPath(this.interaction, Y, te), this.scope.context.requestTreeshakingPass();
  }
}
class Yo extends bs {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.getObjectEntity().deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizeCache() {
    this.getObjectEntity().deoptimizeAllProperties();
  }
  deoptimizePath(e4) {
    this.getObjectEntity().deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.getObjectEntity().getLiteralValueAtPath(e4, t2, n2);
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return this.getObjectEntity().getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return this.getObjectEntity().hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  render(e4, t2, { renderedSurroundingElement: n2 } = Ae) {
    super.render(e4, t2), n2 !== ye && n2 !== fe || (e4.appendRight(this.start, "("), e4.prependLeft(this.end, ")"));
  }
  applyDeoptimizations() {
  }
  getObjectEntity() {
    if (null !== this.objectEntity)
      return this.objectEntity;
    let e4 = Ns;
    const t2 = [];
    for (const n2 of this.properties) {
      if (n2 instanceof Es) {
        t2.push({ key: W, kind: "init", property: n2 });
        continue;
      }
      let s2;
      if (n2.computed) {
        const e5 = n2.key.getLiteralValueAtPath(Y, te, this);
        if ("symbol" == typeof e5) {
          t2.push({ key: W, kind: n2.kind, property: n2 });
          continue;
        }
        s2 = String(e5);
      } else if (s2 = n2.key instanceof gi ? n2.key.name : String(n2.key.value), "__proto__" === s2 && "init" === n2.kind) {
        e4 = n2.value instanceof cr && null === n2.value.value ? null : n2.value;
        continue;
      }
      t2.push({ key: s2, kind: n2.kind, property: n2 });
    }
    return this.objectEntity = new Ps(t2, e4);
  }
}
class Jo extends bs {
  initialise() {
    const e4 = this.scope.context.module.id;
    return lt(hn(ct(un(this.message)), e4));
  }
}
class Xo extends bs {
  initialise() {
    const e4 = this.start, t2 = this.scope.context.module.id, n2 = hn(ct(un(this.message, e4)), t2);
    this.scope.context.error(n2, e4);
  }
}
class Zo extends bs {
}
class Qo extends bs {
  constructor() {
    super(...arguments), this.hasCachedEffect = null, this.hasLoggedEffect = false;
  }
  hasCachedEffects() {
    return !!this.included && (null === this.hasCachedEffect ? this.hasCachedEffect = this.hasEffects(jn()) : this.hasCachedEffect);
  }
  hasEffects(e4) {
    for (const t2 of this.body)
      if (t2.hasEffects(e4)) {
        if (this.scope.context.options.experimentalLogSideEffects && !this.hasLoggedEffect) {
          this.hasLoggedEffect = true;
          const { code: e5, log: n2, module: s2 } = this.scope.context;
          n2(Be, Zt(e5, s2.id, Fe(e5, t2.start, { offsetLine: 1 })), t2.start);
        }
        return this.hasCachedEffect = true;
      }
    return false;
  }
  include(e4, t2) {
    this.included = true;
    for (const n2 of this.body)
      (t2 || n2.shouldBeIncluded(e4)) && n2.include(e4, t2);
  }
  initialise() {
    if (super.initialise(), this.invalidAnnotations)
      for (const { start: e4, end: t2, type: n2 } of this.invalidAnnotations)
        this.scope.context.magicString.remove(e4, t2), "pure" !== n2 && "noSideEffects" !== n2 || this.scope.context.log(Le, nn(this.scope.context.code.slice(e4, t2), this.scope.context.module.id, n2), e4);
  }
  render(e4, t2) {
    let n2 = this.start;
    if (e4.original.startsWith("#!") && (n2 = Math.min(e4.original.indexOf("\n") + 1, this.end), e4.remove(0, n2)), this.body.length > 0) {
      for (; "/" === e4.original[n2] && /[*/]/.test(e4.original[n2 + 1]); ) {
        const t3 = Ti(e4.original.slice(n2, this.body[0].start));
        if (-1 === t3[0])
          break;
        n2 += t3[1];
      }
      zi(this.body, e4, n2, this.end, t2);
    } else
      super.render(e4, t2);
  }
  applyDeoptimizations() {
  }
}
class ea extends xr {
  constructor() {
    super(...arguments), this.declarationInit = null;
  }
  get method() {
    return se(this.flags, 262144);
  }
  set method(e4) {
    this.flags = ie(this.flags, 262144, e4);
  }
  get shorthand() {
    return se(this.flags, 524288);
  }
  set shorthand(e4) {
    this.flags = ie(this.flags, 524288, e4);
  }
  declare(e4, t2) {
    return this.declarationInit = t2, this.value.declare(e4, le);
  }
  hasEffects(e4) {
    this.deoptimized || this.applyDeoptimizations();
    const t2 = this.scope.context.options.treeshake.propertyReadSideEffects;
    return "ObjectPattern" === this.parent.type && "always" === t2 || this.key.hasEffects(e4) || this.value.hasEffects(e4);
  }
  markDeclarationReached() {
    this.value.markDeclarationReached();
  }
  render(e4, t2) {
    this.shorthand || this.key.render(e4, t2), this.value.render(e4, t2, { isShorthandProperty: this.shorthand });
  }
  applyDeoptimizations() {
    this.deoptimized = true, null !== this.declarationInit && (this.declarationInit.deoptimizePath([W, W]), this.scope.context.requestTreeshakingPass());
  }
}
class ta extends bs {
  get computed() {
    return se(this.flags, 1024);
  }
  set computed(e4) {
    this.flags = ie(this.flags, 1024, e4);
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    var _a3;
    (_a3 = this.value) == null ? void 0 : _a3.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizePath(e4) {
    var _a3;
    (_a3 = this.value) == null ? void 0 : _a3.deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.value ? this.value.getLiteralValueAtPath(e4, t2, n2) : re;
  }
  getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) {
    return this.value ? this.value.getReturnExpressionWhenCalledAtPath(e4, t2, n2, s2) : ce;
  }
  hasEffects(e4) {
    var _a3;
    return this.key.hasEffects(e4) || this.static && !!((_a3 = this.value) == null ? void 0 : _a3.hasEffects(e4));
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return !this.value || this.value.hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  applyDeoptimizations() {
  }
}
class na extends bs {
  hasEffects(e4) {
    var _a3;
    return !(e4.ignore.returnYield && !((_a3 = this.argument) == null ? void 0 : _a3.hasEffects(e4))) || (e4.brokenFlow = true, false);
  }
  include(e4, t2) {
    var _a3;
    this.included = true, (_a3 = this.argument) == null ? void 0 : _a3.include(e4, t2), e4.brokenFlow = true;
  }
  initialise() {
    super.initialise(), this.scope.addReturnExpression(this.argument || le);
  }
  render(e4, t2) {
    this.argument && (this.argument.render(e4, t2, { preventASI: true }), this.argument.start === this.start + 6 && e4.prependLeft(this.start + 6, " "));
  }
}
class sa extends bs {
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.expressions[this.expressions.length - 1].deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizePath(e4) {
    this.expressions[this.expressions.length - 1].deoptimizePath(e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    return this.expressions[this.expressions.length - 1].getLiteralValueAtPath(e4, t2, n2);
  }
  hasEffects(e4) {
    for (const t2 of this.expressions)
      if (t2.hasEffects(e4))
        return true;
    return false;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return this.expressions[this.expressions.length - 1].hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  include(e4, t2) {
    this.included = true;
    const n2 = this.expressions[this.expressions.length - 1];
    for (const s2 of this.expressions)
      (t2 || s2 === n2 && !(this.parent instanceof Ui) || s2.shouldBeIncluded(e4)) && s2.include(e4, t2);
  }
  removeAnnotations(e4) {
    this.expressions[0].removeAnnotations(e4);
  }
  render(e4, t2, { renderedParentType: n2, isCalleeOfRenderedParent: s2, preventASI: i2 } = Ae) {
    let r2 = 0, o2 = null;
    const a2 = this.expressions[this.expressions.length - 1];
    for (const { node: l2, separator: c2, start: u2, end: d2 } of Vi(this.expressions, e4, this.start, this.end))
      if (l2.included)
        if (r2++, o2 = c2, 1 === r2 && i2 && Fi(e4, u2, l2.start), 1 === r2) {
          const i3 = n2 || this.parent.type;
          l2.render(e4, t2, { isCalleeOfRenderedParent: s2 && l2 === a2, renderedParentType: i3, renderedSurroundingElement: i3 });
        } else
          l2.render(e4, t2);
      else
        Mi(l2, e4, u2, d2);
    o2 && e4.remove(o2, this.end);
  }
}
class ia extends bs {
  createScope(e4) {
    this.scope = new ji(e4);
  }
  hasEffects(e4) {
    for (const t2 of this.body)
      if (t2.hasEffects(e4))
        return true;
    return false;
  }
  include(e4, t2) {
    this.included = true;
    for (const n2 of this.body)
      (t2 || n2.shouldBeIncluded(e4)) && n2.include(e4, t2);
  }
  render(e4, t2) {
    if (this.body.length > 0) {
      const n2 = _i(e4.original.slice(this.start, this.end), "{") + 1;
      zi(this.body, e4, this.start + n2, this.end - 1, t2);
    } else
      super.render(e4, t2);
  }
}
class ra extends bs {
  bind() {
    this.variable = this.scope.findVariable("this");
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.variable.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizePath(e4) {
    this.variable.deoptimizePath(e4);
  }
  include() {
    this.included || (this.included = true, this.scope.context.includeVariableInModule(this.variable));
  }
}
class oa extends bs {
  hasEffects(e4) {
    var _a3;
    if ((_a3 = this.test) == null ? void 0 : _a3.hasEffects(e4))
      return true;
    for (const t2 of this.consequent) {
      if (e4.brokenFlow)
        break;
      if (t2.hasEffects(e4))
        return true;
    }
    return false;
  }
  include(e4, t2) {
    var _a3;
    this.included = true, (_a3 = this.test) == null ? void 0 : _a3.include(e4, t2);
    for (const n2 of this.consequent)
      (t2 || n2.shouldBeIncluded(e4)) && n2.include(e4, t2);
  }
  render(e4, t2, n2) {
    if (this.consequent.length > 0) {
      this.test && this.test.render(e4, t2);
      const s2 = this.test ? this.test.end : _i(e4.original, "default", this.start) + 7, i2 = _i(e4.original, ":", s2) + 1;
      zi(this.consequent, e4, i2, n2.end, t2);
    } else
      super.render(e4, t2);
  }
}
oa.prototype.needsBoundaries = true;
class aa extends bs {
  createScope(e4) {
    this.parentScope = e4, this.scope = new ji(e4);
  }
  hasEffects(e4) {
    if (this.discriminant.hasEffects(e4))
      return true;
    const { brokenFlow: t2, hasBreak: n2, ignore: s2 } = e4, { breaks: i2 } = s2;
    s2.breaks = true, e4.hasBreak = false;
    let r2 = true;
    for (const n3 of this.cases) {
      if (n3.hasEffects(e4))
        return true;
      r2 && (r2 = e4.brokenFlow && !e4.hasBreak), e4.hasBreak = false, e4.brokenFlow = t2;
    }
    return null !== this.defaultCase && (e4.brokenFlow = r2), s2.breaks = i2, e4.hasBreak = n2, false;
  }
  include(e4, t2) {
    this.included = true, this.discriminant.include(e4, t2);
    const { brokenFlow: n2, hasBreak: s2 } = e4;
    e4.hasBreak = false;
    let i2 = true, r2 = t2 || null !== this.defaultCase && this.defaultCase < this.cases.length - 1;
    for (let s3 = this.cases.length - 1; s3 >= 0; s3--) {
      const o2 = this.cases[s3];
      if (o2.included && (r2 = true), !r2) {
        const e5 = jn();
        e5.ignore.breaks = true, r2 = o2.hasEffects(e5);
      }
      r2 ? (o2.include(e4, t2), i2 && (i2 = e4.brokenFlow && !e4.hasBreak), e4.hasBreak = false, e4.brokenFlow = n2) : i2 = n2;
    }
    r2 && null !== this.defaultCase && (e4.brokenFlow = i2), e4.hasBreak = s2;
  }
  initialise() {
    super.initialise();
    for (let e4 = 0; e4 < this.cases.length; e4++)
      if (null === this.cases[e4].test)
        return void (this.defaultCase = e4);
    this.defaultCase = null;
  }
  parseNode(e4) {
    return this.discriminant = new (this.scope.context.getNodeConstructor(e4.discriminant.type))(this, this.parentScope).parseNode(e4.discriminant), super.parseNode(e4);
  }
  render(e4, t2) {
    this.discriminant.render(e4, t2), this.cases.length > 0 && zi(this.cases, e4, this.cases[0].start, this.end - 1, t2);
  }
}
class la extends fr {
  bind() {
    if (super.bind(), this.tag.type === be) {
      const e4 = this.tag.name;
      this.scope.findVariable(e4).isNamespace && this.scope.context.log(Le, Yt(e4), this.start);
    }
  }
  hasEffects(e4) {
    this.deoptimized || this.applyDeoptimizations();
    for (const t2 of this.quasi.expressions)
      if (t2.hasEffects(e4))
        return true;
    return this.tag.hasEffects(e4) || this.tag.hasEffectsOnInteractionAtPath(Y, this.interaction, e4);
  }
  include(e4, t2) {
    this.deoptimized || this.applyDeoptimizations(), t2 ? super.include(e4, t2) : (this.included = true, this.tag.include(e4, t2), this.quasi.include(e4, t2)), this.tag.includeCallArguments(e4, this.args);
    const [n2] = this.getReturnExpression();
    n2.included || n2.include(e4, false);
  }
  initialise() {
    super.initialise(), this.args = [le, ...this.quasi.expressions], this.interaction = { args: [this.tag instanceof hr && !this.tag.variable ? this.tag.object : null, ...this.args], type: 2, withNew: false };
  }
  render(e4, t2) {
    this.tag.render(e4, t2, { isCalleeOfRenderedParent: true }), this.quasi.render(e4, t2);
  }
  applyDeoptimizations() {
    this.deoptimized = true, this.tag.deoptimizeArgumentsOnInteractionAtPath(this.interaction, Y, te), this.scope.context.requestTreeshakingPass();
  }
  getReturnExpression(e4 = te) {
    return null === this.returnExpression ? (this.returnExpression = ce, this.returnExpression = this.tag.getReturnExpressionWhenCalledAtPath(Y, this.interaction, e4, this)) : this.returnExpression;
  }
}
class ca extends bs {
  get tail() {
    return se(this.flags, 1048576);
  }
  set tail(e4) {
    this.flags = ie(this.flags, 1048576, e4);
  }
  bind() {
  }
  hasEffects() {
    return false;
  }
  include() {
    this.included = true;
  }
  parseNode(e4) {
    return this.value = e4.value, super.parseNode(e4);
  }
  render() {
  }
}
class ua extends bs {
  deoptimizeArgumentsOnInteractionAtPath() {
  }
  getLiteralValueAtPath(e4) {
    return e4.length > 0 || 1 !== this.quasis.length ? re : this.quasis[0].value.cooked;
  }
  getReturnExpressionWhenCalledAtPath(e4) {
    return 1 !== e4.length ? ce : ms(ps, e4[0]);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return 0 === t2.type ? e4.length > 1 : 2 !== t2.type || 1 !== e4.length || fs(ps, e4[0], t2, n2);
  }
  render(e4, t2) {
    e4.indentExclusionRanges.push([this.start, this.end]), super.render(e4, t2);
  }
}
class da extends xe {
  constructor() {
    super("undefined");
  }
  getLiteralValueAtPath() {
  }
}
class ha extends fi {
  constructor(e4, t2, n2) {
    super(e4, t2, t2.declaration, n2, "other"), this.hasId = false, this.originalId = null, this.originalVariable = null;
    const s2 = t2.declaration;
    (s2 instanceof _r || s2 instanceof wr) && s2.id ? (this.hasId = true, this.originalId = s2.id) : s2 instanceof gi && (this.originalId = s2);
  }
  addReference(e4) {
    this.hasId || (this.name = e4.name);
  }
  addUsedPlace(e4) {
    const t2 = this.getOriginalVariable();
    t2 === this ? super.addUsedPlace(e4) : t2.addUsedPlace(e4);
  }
  forbidName(e4) {
    const t2 = this.getOriginalVariable();
    t2 === this ? super.forbidName(e4) : t2.forbidName(e4);
  }
  getAssignedVariableName() {
    return this.originalId && this.originalId.name || null;
  }
  getBaseVariableName() {
    const e4 = this.getOriginalVariable();
    return e4 === this ? super.getBaseVariableName() : e4.getBaseVariableName();
  }
  getDirectOriginalVariable() {
    return !this.originalId || !this.hasId && (this.originalId.isPossibleTDZ() || this.originalId.variable.isReassigned || this.originalId.variable instanceof da || "syntheticNamespace" in this.originalId.variable) ? null : this.originalId.variable;
  }
  getName(e4) {
    const t2 = this.getOriginalVariable();
    return t2 === this ? super.getName(e4) : t2.getName(e4);
  }
  getOriginalVariable() {
    if (this.originalVariable)
      return this.originalVariable;
    let e4, t2 = this;
    const n2 = /* @__PURE__ */ new Set();
    do {
      n2.add(t2), e4 = t2, t2 = e4.getDirectOriginalVariable();
    } while (t2 instanceof ha && !n2.has(t2));
    return this.originalVariable = t2 || e4;
  }
}
class pa extends ki {
  constructor(e4, t2) {
    super(e4, t2), this.variables.set("this", new fi("this", null, es, t2, "other"));
  }
  addDeclaration(e4, t2, n2, s2) {
    return this.context.module.importDescriptions.has(e4.name) && t2.error(dn(e4.name), e4.start), super.addDeclaration(e4, t2, n2, s2);
  }
  addExportDefaultDeclaration(e4, t2, n2) {
    const s2 = new ha(e4, t2, n2);
    return this.variables.set("default", s2), s2;
  }
  addNamespaceMemberAccess() {
  }
  deconflict(e4, t2, n2) {
    for (const s2 of this.children)
      s2.deconflict(e4, t2, n2);
  }
  findLexicalBoundary() {
    return this;
  }
  findVariable(e4) {
    const t2 = this.variables.get(e4) || this.accessedOutsideVariables.get(e4);
    if (t2)
      return t2;
    const n2 = this.context.traceVariable(e4) || this.parent.findVariable(e4);
    return n2 instanceof pi && this.accessedOutsideVariables.set(e4, n2), n2;
  }
}
class fa extends bs {
  bind() {
    this.variable = this.scope.findVariable("this");
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    this.variable.deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2);
  }
  deoptimizePath(e4) {
    this.variable.deoptimizePath(e4);
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    return 0 === e4.length ? 0 !== t2.type : this.variable.hasEffectsOnInteractionAtPath(e4, t2, n2);
  }
  include() {
    this.included || (this.included = true, this.scope.context.includeVariableInModule(this.variable));
  }
  initialise() {
    super.initialise(), this.alias = this.scope.findLexicalBoundary() instanceof pa ? this.scope.context.moduleContext : null, "undefined" === this.alias && this.scope.context.log(Le, { code: "THIS_IS_UNDEFINED", message: "The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten", url: Ke("troubleshooting/#error-this-is-undefined") }, this.start);
  }
  render(e4) {
    null !== this.alias && e4.overwrite(this.start, this.end, this.alias, { contentOnly: false, storeName: true });
  }
}
class ma extends bs {
  hasEffects() {
    return true;
  }
  include(e4, t2) {
    this.included = true, this.argument.include(e4, t2), e4.brokenFlow = true;
  }
  render(e4, t2) {
    this.argument.render(e4, t2, { preventASI: true }), this.argument.start === this.start + 5 && e4.prependLeft(this.start + 5, " ");
  }
}
class ga extends bs {
  constructor() {
    super(...arguments), this.directlyIncluded = false, this.includedLabelsAfterBlock = null;
  }
  hasEffects(e4) {
    var _a3;
    return (this.scope.context.options.treeshake.tryCatchDeoptimization ? this.block.body.length > 0 : this.block.hasEffects(e4)) || !!((_a3 = this.finalizer) == null ? void 0 : _a3.hasEffects(e4));
  }
  include(e4, t2) {
    var _a3, _b;
    const n2 = (_a3 = this.scope.context.options.treeshake) == null ? void 0 : _a3.tryCatchDeoptimization, { brokenFlow: s2, includedLabels: i2 } = e4;
    if (this.directlyIncluded && n2) {
      if (this.includedLabelsAfterBlock)
        for (const e5 of this.includedLabelsAfterBlock)
          i2.add(e5);
    } else
      this.included = true, this.directlyIncluded = true, this.block.include(e4, n2 ? ys : t2), i2.size > 0 && (this.includedLabelsAfterBlock = [...i2]), e4.brokenFlow = s2;
    null !== this.handler && (this.handler.include(e4, t2), e4.brokenFlow = s2), (_b = this.finalizer) == null ? void 0 : _b.include(e4, t2);
  }
}
const ya = { "!": (e4) => !e4, "+": (e4) => +e4, "-": (e4) => -e4, delete: () => re, typeof: (e4) => typeof e4, void: () => {
}, "~": (e4) => ~e4 };
class ba extends bs {
  get prefix() {
    return se(this.flags, 2097152);
  }
  set prefix(e4) {
    this.flags = ie(this.flags, 2097152, e4);
  }
  getLiteralValueAtPath(e4, t2, n2) {
    if (e4.length > 0)
      return re;
    const s2 = this.argument.getLiteralValueAtPath(Y, t2, n2);
    return "symbol" == typeof s2 ? re : ya[this.operator](s2);
  }
  hasEffects(e4) {
    return this.deoptimized || this.applyDeoptimizations(), !("typeof" === this.operator && this.argument instanceof gi) && (this.argument.hasEffects(e4) || "delete" === this.operator && this.argument.hasEffectsOnInteractionAtPath(Y, he, e4));
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }) {
    return 0 !== t2 || e4.length > ("void" === this.operator ? 0 : 1);
  }
  applyDeoptimizations() {
    this.deoptimized = true, "delete" === this.operator && (this.argument.deoptimizePath(Y), this.scope.context.requestTreeshakingPass());
  }
}
class Ea extends bs {
  hasEffects(e4) {
    return this.deoptimized || this.applyDeoptimizations(), this.argument.hasEffectsAsAssignmentTarget(e4, true);
  }
  hasEffectsOnInteractionAtPath(e4, { type: t2 }) {
    return e4.length > 1 || 0 !== t2;
  }
  include(e4, t2) {
    this.deoptimized || this.applyDeoptimizations(), this.included = true, this.argument.includeAsAssignmentTarget(e4, t2, true);
  }
  initialise() {
    super.initialise(), this.argument.setAssignedValue(le);
  }
  render(e4, t2) {
    const { exportNamesByVariable: n2, format: s2, snippets: { _: i2 } } = t2;
    if (this.argument.render(e4, t2), "system" === s2) {
      const s3 = this.argument.variable, r2 = n2.get(s3);
      if (r2)
        if (this.prefix)
          1 === r2.length ? Yi(s3, this.start, this.end, e4, t2) : Ji(s3, this.start, this.end, this.parent.type !== ye, e4, t2);
        else {
          const n3 = this.operator[0];
          !function(e5, t3, n4, s4, i3, r3, o2) {
            const { _: a2 } = r3.snippets;
            i3.prependRight(t3, `${Ki([e5], r3, o2)},${a2}`), s4 && (i3.prependRight(t3, "("), i3.appendLeft(n4, ")"));
          }(s3, this.start, this.end, this.parent.type !== ye, e4, t2, `${i2}${n3}${i2}1`);
        }
    }
  }
  applyDeoptimizations() {
    if (this.deoptimized = true, this.argument.deoptimizePath(Y), this.argument instanceof gi) {
      this.scope.findVariable(this.argument.name).markReassigned();
    }
    this.scope.context.requestTreeshakingPass();
  }
}
class xa extends bs {
  deoptimizePath() {
    for (const e4 of this.declarations)
      e4.deoptimizePath(Y);
  }
  hasEffectsOnInteractionAtPath() {
    return false;
  }
  include(e4, t2, { asSingleStatement: n2 } = Ae) {
    this.included = true;
    for (const s2 of this.declarations) {
      (t2 || s2.shouldBeIncluded(e4)) && s2.include(e4, t2);
      const { id: i2, init: r2 } = s2;
      n2 && i2.include(e4, t2), r2 && i2.included && !r2.included && (i2 instanceof Xi || i2 instanceof Gs) && r2.include(e4, t2);
    }
  }
  initialise() {
    super.initialise(), this.isUsingDeclaration = "await using" === this.kind || "using" === this.kind;
    for (const e4 of this.declarations)
      e4.declareDeclarator(this.kind, this.isUsingDeclaration);
  }
  removeAnnotations(e4) {
    this.declarations[0].removeAnnotations(e4);
  }
  render(e4, t2, n2 = Ae) {
    if (this.isUsingDeclaration || function(e5, t3) {
      for (const n3 of e5) {
        if (!n3.id.included)
          return false;
        if (n3.id.type === be) {
          if (t3.has(n3.id.variable))
            return false;
        } else {
          const e6 = [];
          if (n3.id.addExportedVariables(e6, t3), e6.length > 0)
            return false;
        }
      }
      return true;
    }(this.declarations, t2.exportNamesByVariable)) {
      for (const n3 of this.declarations)
        n3.render(e4, t2);
      n2.isNoStatement || 59 === e4.original.charCodeAt(this.end - 1) || e4.appendLeft(this.end, ";");
    } else
      this.renderReplacedDeclarations(e4, t2);
  }
  applyDeoptimizations() {
  }
  renderDeclarationEnd(e4, t2, n2, s2, i2, r2, o2) {
    59 === e4.original.charCodeAt(this.end - 1) && e4.remove(this.end - 1, this.end), t2 += ";", null === n2 ? e4.appendLeft(i2, t2) : (10 !== e4.original.charCodeAt(s2 - 1) || 10 !== e4.original.charCodeAt(this.end) && 13 !== e4.original.charCodeAt(this.end) || (s2--, 13 === e4.original.charCodeAt(s2) && s2--), s2 === n2 + 1 ? e4.overwrite(n2, i2, t2) : (e4.overwrite(n2, n2 + 1, t2), e4.remove(s2, i2))), r2.length > 0 && e4.appendLeft(i2, ` ${Ki(r2, o2)};`);
  }
  renderReplacedDeclarations(e4, t2) {
    const n2 = Vi(this.declarations, e4, this.start + this.kind.length, this.end - (59 === e4.original.charCodeAt(this.end - 1) ? 1 : 0));
    let s2, i2;
    i2 = Bi(e4.original, this.start + this.kind.length);
    let r2 = i2 - 1;
    e4.remove(this.start, r2);
    let o2, l2 = false, c2 = false, u2 = "";
    const d2 = [], h2 = function(e5, t3, n3) {
      var _a3;
      let s3 = null;
      if ("system" === t3.format) {
        for (const { node: i3 } of e5)
          i3.id instanceof gi && i3.init && 0 === n3.length && 1 === ((_a3 = t3.exportNamesByVariable.get(i3.id.variable)) == null ? void 0 : _a3.length) ? (s3 = i3.id.variable, n3.push(s3)) : i3.id.addExportedVariables(n3, t3.exportNamesByVariable);
        n3.length > 1 ? s3 = null : s3 && (n3.length = 0);
      }
      return s3;
    }(n2, t2, d2);
    for (const { node: d3, start: p2, separator: f2, contentEnd: m2, end: g2 } of n2)
      if (d3.included) {
        if (d3.render(e4, t2), o2 = "", !d3.id.included || d3.id instanceof gi && wo(d3.id.variable, t2.exportNamesByVariable))
          c2 && (u2 += ";"), l2 = false;
        else {
          if (h2 && h2 === d3.id.variable) {
            const n3 = _i(e4.original, "=", d3.id.end);
            Yi(h2, Bi(e4.original, n3 + 1), null === f2 ? m2 : f2, e4, t2);
          }
          l2 ? u2 += "," : (c2 && (u2 += ";"), o2 += `${this.kind} `, l2 = true);
        }
        i2 === r2 + 1 ? e4.overwrite(r2, i2, u2 + o2) : (e4.overwrite(r2, r2 + 1, u2), e4.appendLeft(i2, o2)), s2 = m2, i2 = g2, c2 = true, r2 = f2, u2 = "";
      } else
        e4.remove(p2, g2), d3.removeAnnotations(e4);
    this.renderDeclarationEnd(e4, u2, r2, s2, i2, d2, t2);
  }
}
class $a extends bs {
  hasEffects(e4) {
    return !!this.test.hasEffects(e4) || Cr(e4, this.body);
  }
  include(e4, t2) {
    this.included = true, this.test.include(e4, t2), Or(e4, this.body, t2);
  }
}
class Aa extends bs {
  hasEffects(e4) {
    var _a3;
    return this.deoptimized || this.applyDeoptimizations(), !(e4.ignore.returnYield && !((_a3 = this.argument) == null ? void 0 : _a3.hasEffects(e4)));
  }
  render(e4, t2) {
    this.argument && (this.argument.render(e4, t2, { preventASI: true }), this.argument.start === this.start + 5 && e4.prependLeft(this.start + 5, " "));
  }
}
const Sa = ["PanicError", "ParseError", "ArrayExpression", "ArrayPattern", "ArrowFunctionExpression", "AssignmentExpression", "AssignmentPattern", "AwaitExpression", "BinaryExpression", "BlockStatement", "BreakStatement", "CallExpression", "CatchClause", "ChainExpression", "ClassBody", "ClassDeclaration", "ClassExpression", "ConditionalExpression", "ContinueStatement", "DebuggerStatement", "ExpressionStatement", "DoWhileStatement", "EmptyStatement", "ExportAllDeclaration", "ExportDefaultDeclaration", "ExportNamedDeclaration", "ExportSpecifier", "ExpressionStatement", "ForInStatement", "ForOfStatement", "ForStatement", "FunctionDeclaration", "FunctionExpression", "Identifier", "IfStatement", "ImportAttribute", "ImportDeclaration", "ImportDefaultSpecifier", "ImportExpression", "ImportNamespaceSpecifier", "ImportSpecifier", "LabeledStatement", "Literal", "Literal", "Literal", "Literal", "Literal", "Literal", "LogicalExpression", "MemberExpression", "MetaProperty", "MethodDefinition", "NewExpression", "ObjectExpression", "ObjectPattern", "PrivateIdentifier", "Program", "Property", "PropertyDefinition", "RestElement", "ReturnStatement", "SequenceExpression", "SpreadElement", "StaticBlock", "Super", "SwitchCase", "SwitchStatement", "TaggedTemplateExpression", "TemplateElement", "TemplateLiteral", "ThisExpression", "ThrowStatement", "TryStatement", "UnaryExpression", "UpdateExpression", "VariableDeclaration", "VariableDeclarator", "WhileStatement", "YieldExpression"], wa = [Jo, Xo, Us, Gs, Hi, Zi, Qi, ir, or, Gi, ar, mr, gr, yr, Er, wr, vr, Ir, kr, Nr, Ui, Dr, Mr, Rr, Lr, Br, Tr, Ui, zr, Vr, Fr, _r, jr, gi, Wr, qr, Hr, Kr, Po, Co, Oo, Do, cr, cr, cr, cr, cr, cr, Mo, hr, Lo, $r, Ko, Yo, Xi, Zo, Qo, ea, ta, Wi, na, sa, Es, ia, ra, oa, aa, la, ca, ua, fa, ma, ga, ba, Ea, xa, vo, $a, Aa], va = [function(e4, t2, n2, s2) {
  e4.message = Kn(n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  e4.message = Kn(n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.elements = Ia(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.elements = Ia(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.async = !(1 & ~r2), e4.expression = !(2 & ~r2), e4.generator = !(4 & ~r2);
  const o2 = e4.annotations = qn(n2[t2 + 1], n2);
  e4.annotationNoSideEffects = o2.some((e5) => "noSideEffects" === e5.type);
  const a2 = e4.params = Ia(e4, i2, n2[t2 + 2], n2, s2);
  i2.addParameterVariables(a2.map((e5) => e5.declare("parameter", le)), a2[a2.length - 1] instanceof Wi), e4.body = Pa(e4, i2.bodyScope, n2[t2 + 3], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.operator = Un[n2[t2]], e4.left = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.right = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.left = Pa(e4, i2, n2[t2], n2, s2), e4.right = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.argument = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.operator = Un[n2[t2]], e4.left = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.right = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.body = Ia(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.label = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.optional = !(1 & ~r2), e4.annotations = qn(n2[t2 + 1], n2), e4.callee = Pa(e4, i2, n2[t2 + 2], n2, s2), e4.arguments = Ia(e4, i2, n2[t2 + 3], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2], o2 = e4.param = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
  o2 == null ? void 0 : o2.declare("parameter", le), e4.body = Pa(e4, i2.bodyScope, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.expression = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2], o2 = e4.body = [];
  if (r2) {
    const t3 = n2[r2];
    for (let a2 = 0; a2 < t3; a2++) {
      const t4 = n2[r2 + 1 + a2];
      o2.push(Pa(e4, 1 & n2[t4 + 3] ? i2 : i2.instanceScope, t4, n2, s2));
    }
  }
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.id = 0 === r2 ? null : Pa(e4, i2.parent, r2, n2, s2);
  const o2 = n2[t2 + 1];
  e4.superClass = 0 === o2 ? null : Pa(e4, i2, o2, n2, s2), e4.body = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.id = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
  const o2 = n2[t2 + 1];
  e4.superClass = 0 === o2 ? null : Pa(e4, i2, o2, n2, s2), e4.body = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.test = Pa(e4, i2, n2[t2], n2, s2), e4.consequent = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.alternate = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.label = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
}, function() {
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.directive = Kn(n2[t2], n2, s2), e4.expression = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.body = Pa(e4, i2, n2[t2], n2, s2), e4.test = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function() {
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.exported = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2), e4.source = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.attributes = Ia(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.declaration = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.specifiers = Ia(e4, i2, n2[t2], n2, s2);
  const r2 = n2[t2 + 1];
  e4.source = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2), e4.attributes = Ia(e4, i2, n2[t2 + 2], n2, s2);
  const o2 = n2[t2 + 3];
  e4.declaration = 0 === o2 ? null : Pa(e4, i2, o2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.local = Pa(e4, i2, n2[t2], n2, s2);
  const r2 = n2[t2 + 1];
  e4.exported = 0 === r2 ? e4.local : Pa(e4, i2, r2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.expression = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.left = Pa(e4, i2, n2[t2], n2, s2), e4.right = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.body = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.await = !(1 & ~r2), e4.left = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.right = Pa(e4, i2, n2[t2 + 2], n2, s2), e4.body = Pa(e4, i2, n2[t2 + 3], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.init = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
  const o2 = n2[t2 + 1];
  e4.test = 0 === o2 ? null : Pa(e4, i2, o2, n2, s2);
  const a2 = n2[t2 + 2];
  e4.update = 0 === a2 ? null : Pa(e4, i2, a2, n2, s2), e4.body = Pa(e4, i2, n2[t2 + 3], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.async = !(1 & ~r2), e4.generator = !(2 & ~r2);
  const o2 = e4.annotations = qn(n2[t2 + 1], n2);
  e4.annotationNoSideEffects = o2.some((e5) => "noSideEffects" === e5.type);
  const a2 = n2[t2 + 2];
  e4.id = 0 === a2 ? null : Pa(e4, i2.parent, a2, n2, s2);
  const l2 = e4.params = Ia(e4, i2, n2[t2 + 3], n2, s2);
  i2.addParameterVariables(l2.map((e5) => e5.declare("parameter", le)), l2[l2.length - 1] instanceof Wi), e4.body = Pa(e4, i2.bodyScope, n2[t2 + 4], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.async = !(1 & ~r2), e4.generator = !(2 & ~r2);
  const o2 = e4.annotations = qn(n2[t2 + 1], n2);
  e4.annotationNoSideEffects = o2.some((e5) => "noSideEffects" === e5.type);
  const a2 = n2[t2 + 2];
  e4.id = 0 === a2 ? null : Pa(e4, e4.idScope, a2, n2, s2);
  const l2 = e4.params = Ia(e4, i2, n2[t2 + 3], n2, s2);
  i2.addParameterVariables(l2.map((e5) => e5.declare("parameter", le)), l2[l2.length - 1] instanceof Wi), e4.body = Pa(e4, i2.bodyScope, n2[t2 + 4], n2, s2);
}, function(e4, t2, n2, s2) {
  e4.name = Kn(n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.test = Pa(e4, i2, n2[t2], n2, s2), e4.consequent = Pa(e4, e4.consequentScope = new Ur(i2), n2[t2 + 1], n2, s2);
  const r2 = n2[t2 + 2];
  e4.alternate = 0 === r2 ? null : Pa(e4, e4.alternateScope = new Ur(i2), r2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.key = Pa(e4, i2, n2[t2], n2, s2), e4.value = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.specifiers = Ia(e4, i2, n2[t2], n2, s2), e4.source = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.attributes = Ia(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.local = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.source = Pa(e4, i2, n2[t2], n2, s2), e4.sourceAstNode = Jn(n2[t2], n2, s2);
  const r2 = n2[t2 + 1];
  e4.options = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.local = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.local = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.imported = 0 === r2 ? e4.local : Pa(e4, i2, r2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.label = Pa(e4, i2, n2[t2], n2, s2), e4.body = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const i2 = e4.bigint = Kn(n2[t2], n2, s2);
  e4.raw = Kn(n2[t2 + 1], n2, s2), e4.value = BigInt(i2);
}, function(e4, t2, n2) {
  const s2 = n2[t2], i2 = e4.value = !(1 & ~s2);
  e4.raw = i2 ? "true" : "false";
}, function(e4) {
  e4.value = null;
}, function(e4, t2, n2, s2) {
  const i2 = n2[t2];
  e4.raw = 0 === i2 ? void 0 : Kn(i2, n2, s2), e4.value = new DataView(n2.buffer).getFloat64(t2 + 1 << 2, true);
}, function(e4, t2, n2, s2) {
  const i2 = Kn(n2[t2], n2, s2), r2 = Kn(n2[t2 + 1], n2, s2);
  e4.raw = `/${r2}/${i2}`, e4.regex = { flags: i2, pattern: r2 }, e4.value = new RegExp(r2, i2);
}, function(e4, t2, n2, s2) {
  e4.value = Kn(n2[t2], n2, s2);
  const i2 = n2[t2 + 1];
  e4.raw = 0 === i2 ? void 0 : Kn(i2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.operator = Un[n2[t2]], e4.left = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.right = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.computed = !(1 & ~r2), e4.optional = !(2 & ~r2), e4.object = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.property = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.meta = Pa(e4, i2, n2[t2], n2, s2), e4.property = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.static = !(1 & ~r2), e4.computed = !(2 & ~r2), e4.key = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.value = Pa(e4, i2, n2[t2 + 2], n2, s2), e4.kind = Un[n2[t2 + 3]];
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.annotations = qn(n2[t2], n2), e4.callee = Pa(e4, i2, n2[t2 + 1], n2, s2), e4.arguments = Ia(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.properties = Ia(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.properties = Ia(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  e4.name = Kn(n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.body = Ia(e4, i2, n2[t2], n2, s2), e4.invalidAnnotations = qn(n2[t2 + 1], n2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.method = !(1 & ~r2), e4.shorthand = !(2 & ~r2), e4.computed = !(4 & ~r2);
  const o2 = n2[t2 + 1];
  e4.value = Pa(e4, i2, n2[t2 + 2], n2, s2), e4.kind = Un[n2[t2 + 3]], e4.key = 0 === o2 ? e4.value : Pa(e4, i2, o2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.static = !(1 & ~r2), e4.computed = !(2 & ~r2), e4.key = Pa(e4, i2, n2[t2 + 1], n2, s2);
  const o2 = n2[t2 + 2];
  e4.value = 0 === o2 ? null : Pa(e4, i2, o2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.argument = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.argument = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.expressions = Ia(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.argument = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.body = Ia(e4, i2, n2[t2], n2, s2);
}, function() {
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.test = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2), e4.consequent = Ia(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.discriminant = Pa(e4, e4.parentScope, n2[t2], n2, s2), e4.cases = Ia(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.tag = Pa(e4, i2, n2[t2], n2, s2), e4.quasi = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const i2 = n2[t2];
  e4.tail = !(1 & ~i2);
  const r2 = n2[t2 + 1], o2 = 0 === r2 ? void 0 : Kn(r2, n2, s2), a2 = Kn(n2[t2 + 2], n2, s2);
  e4.value = { cooked: o2, raw: a2 };
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.quasis = Ia(e4, i2, n2[t2], n2, s2), e4.expressions = Ia(e4, i2, n2[t2 + 1], n2, s2);
}, function() {
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.argument = Pa(e4, i2, n2[t2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.block = Pa(e4, i2, n2[t2], n2, s2);
  const r2 = n2[t2 + 1];
  e4.handler = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
  const o2 = n2[t2 + 2];
  e4.finalizer = 0 === o2 ? null : Pa(e4, i2, o2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.operator = Un[n2[t2]], e4.argument = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.prefix = !(1 & ~r2), e4.operator = Un[n2[t2 + 1]], e4.argument = Pa(e4, i2, n2[t2 + 2], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.kind = Un[n2[t2]], e4.declarations = Ia(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.id = Pa(e4, i2, n2[t2], n2, s2);
  const r2 = n2[t2 + 1];
  e4.init = 0 === r2 ? null : Pa(e4, i2, r2, n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4;
  e4.test = Pa(e4, i2, n2[t2], n2, s2), e4.body = Pa(e4, i2, n2[t2 + 1], n2, s2);
}, function(e4, t2, n2, s2) {
  const { scope: i2 } = e4, r2 = n2[t2];
  e4.delegate = !(1 & ~r2);
  const o2 = n2[t2 + 1];
  e4.argument = 0 === o2 ? null : Pa(e4, i2, o2, n2, s2);
}];
function Pa(e4, t2, n2, s2, i2) {
  const r2 = s2[n2], o2 = wa[r2];
  if (!o2)
    throw console.trace(), new Error(`Unknown node type: ${r2}`);
  const a2 = new o2(e4, t2);
  return a2.type = Sa[r2], a2.start = s2[n2 + 1], a2.end = s2[n2 + 2], va[r2](a2, n2 + 3, s2, i2), a2.initialise(), a2;
}
function Ia(e4, t2, n2, s2, i2) {
  if (0 === n2)
    return we;
  const r2 = s2[n2++], o2 = [];
  for (let a2 = 0; a2 < r2; a2++) {
    const r3 = s2[n2++];
    o2.push(r3 ? Pa(e4, t2, r3, s2, i2) : null);
  }
  return o2;
}
const ka = { ArrayExpression: Us, ArrayPattern: Gs, ArrowFunctionExpression: Hi, AssignmentExpression: Zi, AssignmentPattern: Qi, AwaitExpression: ir, BinaryExpression: or, BlockStatement: Gi, BreakStatement: ar, CallExpression: mr, CatchClause: gr, ChainExpression: yr, ClassBody: Er, ClassDeclaration: wr, ClassExpression: vr, ConditionalExpression: Ir, ContinueStatement: kr, DebuggerStatement: Nr, DoWhileStatement: Dr, EmptyStatement: Mr, ExportAllDeclaration: Rr, ExportDefaultDeclaration: Lr, ExportNamedDeclaration: Br, ExportSpecifier: Tr, ExpressionStatement: Ui, ForInStatement: zr, ForOfStatement: Vr, ForStatement: Fr, FunctionDeclaration: _r, FunctionExpression: jr, Identifier: gi, IfStatement: Wr, ImportAttribute: qr, ImportDeclaration: Hr, ImportDefaultSpecifier: Kr, ImportExpression: Po, ImportNamespaceSpecifier: Co, ImportSpecifier: Oo, LabeledStatement: Do, Literal: cr, LogicalExpression: Mo, MemberExpression: hr, MetaProperty: Lo, MethodDefinition: $r, NewExpression: Ko, ObjectExpression: Yo, ObjectPattern: Xi, PanicError: Jo, ParseError: Xo, PrivateIdentifier: Zo, Program: Qo, Property: ea, PropertyDefinition: ta, RestElement: Wi, ReturnStatement: na, SequenceExpression: sa, SpreadElement: Es, StaticBlock: ia, Super: ra, SwitchCase: oa, SwitchStatement: aa, TaggedTemplateExpression: la, TemplateElement: ca, TemplateLiteral: ua, ThisExpression: fa, ThrowStatement: ma, TryStatement: ga, UnaryExpression: ba, UnknownNode: class extends bs {
  hasEffects() {
    return true;
  }
  include(e4) {
    super.include(e4, true);
  }
}, UpdateExpression: Ea, VariableDeclaration: xa, VariableDeclarator: vo, WhileStatement: $a, YieldExpression: Aa }, Na = "_missingExportShim";
class Ca extends xe {
  constructor(e4) {
    super(Na), this.module = e4;
  }
  include() {
    super.include(), this.module.needsExportShim = true;
  }
}
class Oa extends xe {
  constructor(e4) {
    super(e4.getModuleName()), this.memberVariables = null, this.mergedNamespaces = [], this.referencedEarly = false, this.references = [], this.context = e4, this.module = e4.module;
  }
  addReference(e4) {
    this.references.push(e4), this.name = e4.name;
  }
  deoptimizeArgumentsOnInteractionAtPath(e4, t2, n2) {
    var _a3;
    if (t2.length > 1 || 1 === t2.length && 2 === e4.type) {
      const s2 = t2[0];
      "string" == typeof s2 ? (_a3 = this.getMemberVariables()[s2]) == null ? void 0 : _a3.deoptimizeArgumentsOnInteractionAtPath(e4, t2.slice(1), n2) : ue(e4);
    }
  }
  deoptimizePath(e4) {
    var _a3;
    if (e4.length > 1) {
      const t2 = e4[0];
      "string" == typeof t2 && ((_a3 = this.getMemberVariables()[t2]) == null ? void 0 : _a3.deoptimizePath(e4.slice(1)));
    }
  }
  getLiteralValueAtPath(e4) {
    return e4[0] === K ? "Module" : re;
  }
  getMemberVariables() {
    if (this.memberVariables)
      return this.memberVariables;
    const e4 = /* @__PURE__ */ Object.create(null), t2 = [...this.context.getExports(), ...this.context.getReexports()].sort();
    for (const n2 of t2)
      if ("*" !== n2[0] && n2 !== this.module.info.syntheticNamedExports) {
        const t3 = this.context.traceExport(n2);
        t3 && (e4[n2] = t3);
      }
    return this.memberVariables = e4;
  }
  hasEffectsOnInteractionAtPath(e4, t2, n2) {
    const { type: s2 } = t2;
    if (0 === e4.length)
      return true;
    if (1 === e4.length && 2 !== s2)
      return 1 === s2;
    const i2 = e4[0];
    if ("string" != typeof i2)
      return true;
    const r2 = this.getMemberVariables()[i2];
    return !r2 || r2.hasEffectsOnInteractionAtPath(e4.slice(1), t2, n2);
  }
  include() {
    super.include(), this.context.includeAllExports();
  }
  prepare(e4) {
    this.mergedNamespaces.length > 0 && this.module.scope.addAccessedGlobals([to], e4);
  }
  renderBlock(e4) {
    const { exportNamesByVariable: t2, format: n2, freeze: s2, indent: i2, symbols: r2, snippets: { _: o2, cnst: a2, getObject: l2, getPropertyAccess: c2, n: u2, s: d2 } } = e4, h2 = this.getMemberVariables(), p2 = Object.entries(h2).filter(([e5, t3]) => t3.included).map(([e5, t3]) => this.referencedEarly || t3.isReassigned || t3 === this ? [null, `get ${Me(e5)}${o2}()${o2}{${o2}return ${t3.getName(c2)}${d2}${o2}}`] : [e5, t3.getName(c2)]);
    p2.unshift([null, `__proto__:${o2}null`]);
    let f2 = l2(p2, { lineBreakIndent: { base: "", t: i2 } });
    if (this.mergedNamespaces.length > 0) {
      const e5 = this.mergedNamespaces.map((e6) => e6.getName(c2));
      f2 = `/*#__PURE__*/${to}(${f2},${o2}[${e5.join(`,${o2}`)}])`;
    } else
      r2 && (f2 = `/*#__PURE__*/Object.defineProperty(${f2},${o2}Symbol.toStringTag,${o2}${So(l2)})`), s2 && (f2 = `/*#__PURE__*/Object.freeze(${f2})`);
    return f2 = `${a2} ${this.getName(c2)}${o2}=${o2}${f2};`, "system" === n2 && t2.has(this) && (f2 += `${u2}${Ki([this], e4)};`), f2;
  }
  renderFirst() {
    return this.referencedEarly;
  }
  setMergedNamespaces(e4) {
    this.mergedNamespaces = e4;
    const t2 = this.context.getModuleExecIndex();
    for (const e5 of this.references) {
      const { context: n2 } = e5.scope;
      if (n2.getModuleExecIndex() <= t2) {
        this.referencedEarly = true;
        break;
      }
    }
  }
}
Oa.prototype.isNamespace = true;
class Da extends xe {
  constructor(e4, t2, n2) {
    super(t2), this.baseVariable = null, this.context = e4, this.module = e4.module, this.syntheticNamespace = n2;
  }
  getBaseVariable() {
    if (this.baseVariable)
      return this.baseVariable;
    let e4 = this.syntheticNamespace;
    for (; e4 instanceof ha || e4 instanceof Da; ) {
      if (e4 instanceof ha) {
        const t2 = e4.getOriginalVariable();
        if (t2 === e4)
          break;
        e4 = t2;
      }
      e4 instanceof Da && (e4 = e4.syntheticNamespace);
    }
    return this.baseVariable = e4;
  }
  getBaseVariableName() {
    return this.syntheticNamespace.getBaseVariableName();
  }
  getName(e4) {
    return `${this.syntheticNamespace.getName(e4)}${e4(this.name)}`;
  }
  include() {
    super.include(), this.context.includeVariableInModule(this.syntheticNamespace);
  }
  setRenderNames(e4, t2) {
    super.setRenderNames(e4, t2);
  }
}
var Ma;
!function(e4) {
  e4[e4.LOAD_AND_PARSE = 0] = "LOAD_AND_PARSE", e4[e4.ANALYSE = 1] = "ANALYSE", e4[e4.GENERATE = 2] = "GENERATE";
}(Ma || (Ma = {}));
const Ra = /* @__PURE__ */ new WeakMap();
function _a2(e4, t2) {
  if (e4) {
    const t3 = Ra.get(e4);
    t3 && function(e5) {
      void 0 === e5.encodedMappings && e5.decodedMappings && (e5.encodedMappings = n.encode(e5.decodedMappings)), e5.decodedMappings = void 0;
    }(t3);
  }
  if (t2)
    for (const e5 of t2)
      e5.missing || _a2(e5);
}
function La(e4) {
  if (!e4)
    return null;
  if ("string" == typeof e4 && (e4 = JSON.parse(e4)), !e4.mappings)
    return { mappings: [], names: [], sources: [], version: 3 };
  const t2 = e4.mappings, s2 = Array.isArray(t2), i2 = { decodedMappings: s2 ? t2 : void 0, encodedMappings: s2 ? void 0 : t2 }, r2 = { ...e4, get mappings() {
    return i2.decodedMappings || (i2.decodedMappings = i2.encodedMappings ? n.decode(i2.encodedMappings) : [], i2.encodedMappings = void 0), i2.decodedMappings;
  } };
  return Ra.set(r2, i2), r2;
}
function Ba(e4) {
  return e4.id;
}
const Ta = (e4, { allowReturnOutsideFunction: t2 = false } = {}) => {
  const n2 = Bn(e4, t2);
  return function(e5, t3) {
    const n3 = Jn(0, new Uint32Array(e5), t3);
    switch (n3.type) {
      case "PanicError":
        return lt(ct(un(n3.message)));
      case "ParseError":
        return lt(ct(un(n3.message, n3.start)));
      default:
        return n3;
    }
  }(n2.buffer, Zn(n2));
}, za = /* @__PURE__ */ new Set(["assert", "with"]);
function Va(e4) {
  var _a3;
  const { scope: { context: t2 }, options: n2, start: s2 } = e4;
  if (!(n2 instanceof Yo))
    return n2 && t2.module.log(Le, rn(t2.module.id), s2), Se;
  const i2 = (_a3 = n2.properties.find((e5) => za.has(Fa(e5)))) == null ? void 0 : _a3.value;
  if (!i2)
    return Se;
  if (!(i2 instanceof Yo))
    return t2.module.log(Le, (r2 = t2.module.id, { code: Pt, message: `Rollup could not statically analyze the options argument of a dynamic import in "${B(r2)}". Dynamic import options need to be an object with a nested attributes object.` }), s2), Se;
  var r2;
  const o2 = i2.properties.map((e5) => {
    const n3 = Fa(e5);
    return "string" == typeof n3 && "string" == typeof e5.value.value ? [n3, e5.value.value] : (t2.module.log(Le, rn(t2.module.id), e5.start), null);
  }).filter((e5) => !!e5);
  return o2.length > 0 ? Object.fromEntries(o2) : Se;
}
const Fa = (e4) => {
  const t2 = e4.key;
  return t2 && !e4.computed && (t2.name || t2.value);
};
function ja(e4, t2) {
  const n2 = Object.keys(e4);
  return n2.length !== Object.keys(t2).length || n2.some((n3) => e4[n3] !== t2[n3]);
}
var Ua = "performance" in ("undefined" == typeof globalThis ? "undefined" == typeof window ? {} : window : globalThis) ? performance : { now: () => 0 }, Ga = { memoryUsage: () => ({ heapUsed: 0 }) };
let Wa = /* @__PURE__ */ new Map();
function qa(e4, t2) {
  switch (t2) {
    case 1:
      return `# ${e4}`;
    case 2:
      return `## ${e4}`;
    case 3:
      return e4;
    default:
      return `- ${e4}`;
  }
}
function Ha(e4, t2 = 3) {
  e4 = qa(e4, t2);
  const n2 = Ga.memoryUsage().heapUsed, s2 = Ua.now(), i2 = Wa.get(e4);
  void 0 === i2 ? Wa.set(e4, { memory: 0, startMemory: n2, startTime: s2, time: 0, totalMemory: 0 }) : (i2.startMemory = n2, i2.startTime = s2);
}
function Ka(e4, t2 = 3) {
  e4 = qa(e4, t2);
  const n2 = Wa.get(e4);
  if (void 0 !== n2) {
    const e5 = Ga.memoryUsage().heapUsed;
    n2.memory += e5 - n2.startMemory, n2.time += Ua.now() - n2.startTime, n2.totalMemory = Math.max(n2.totalMemory, e5);
  }
}
function Ya() {
  const e4 = {};
  for (const [t2, { memory: n2, time: s2, totalMemory: i2 }] of Wa)
    e4[t2] = [s2, n2, i2];
  return e4;
}
let Ja = Hs, Xa = Hs;
const Za = ["augmentChunkHash", "buildEnd", "buildStart", "generateBundle", "load", "moduleParsed", "options", "outputOptions", "renderChunk", "renderDynamicImport", "renderStart", "resolveDynamicImport", "resolveFileUrl", "resolveId", "resolveImportMeta", "shouldTransformCachedModule", "transform", "writeBundle"];
function Qa(e4, t2) {
  if (e4._hasTimer)
    return e4;
  e4._hasTimer = true;
  for (const n2 of Za)
    if (n2 in e4) {
      let s2 = `plugin ${t2}`;
      e4.name && (s2 += ` (${e4.name})`), s2 += ` - ${n2}`;
      const i2 = function(...e5) {
        Ja(s2, 4);
        const t3 = r2.apply(this, e5);
        return Xa(s2, 4), t3;
      };
      let r2;
      "function" == typeof e4[n2].handler ? (r2 = e4[n2].handler, e4[n2].handler = i2) : (r2 = e4[n2], e4[n2] = i2);
    }
  return e4;
}
function el(e4) {
  e4.isExecuted = true;
  const t2 = [e4], n2 = /* @__PURE__ */ new Set();
  for (const e5 of t2)
    for (const s2 of [...e5.dependencies, ...e5.implicitlyLoadedBefore])
      s2 instanceof En || s2.isExecuted || !s2.info.moduleSideEffects && !e5.implicitlyLoadedBefore.has(s2) || n2.has(s2.id) || (s2.isExecuted = true, n2.add(s2.id), t2.push(s2));
}
const tl = { identifier: null, localName: Na };
function nl(e4, t2, n2, s2, i2 = /* @__PURE__ */ new Map()) {
  const r2 = i2.get(t2);
  if (r2) {
    if (r2.has(e4))
      return s2 ? [null] : lt((o2 = t2, a2 = e4.id, { code: Et, exporter: a2, message: `"${o2}" cannot be exported from "${B(a2)}" as it is a reexport that references itself.` }));
    r2.add(e4);
  } else
    i2.set(t2, /* @__PURE__ */ new Set([e4]));
  var o2, a2;
  return e4.getVariableForExportName(t2, { importerForSideEffects: n2, isExportAllSearch: s2, searchedNamesAndModules: i2 });
}
function sl(e4, t2) {
  const n2 = j(t2.sideEffectDependenciesByVariable, e4, U);
  let s2 = e4;
  const i2 = /* @__PURE__ */ new Set([s2]);
  for (; ; ) {
    const e5 = s2.module;
    if (s2 = s2 instanceof ha ? s2.getDirectOriginalVariable() : s2 instanceof Da ? s2.syntheticNamespace : null, !s2 || i2.has(s2))
      break;
    i2.add(s2), n2.add(e5);
    const t3 = e5.sideEffectDependenciesByVariable.get(s2);
    if (t3)
      for (const e6 of t3)
        n2.add(e6);
  }
  return n2;
}
class il {
  constructor(e4, t2, n2, s2, i2, r2, o2, a2) {
    this.graph = e4, this.id = t2, this.options = n2, this.alternativeReexportModules = /* @__PURE__ */ new Map(), this.chunkFileNames = /* @__PURE__ */ new Set(), this.chunkNames = [], this.cycles = /* @__PURE__ */ new Set(), this.dependencies = /* @__PURE__ */ new Set(), this.dynamicDependencies = /* @__PURE__ */ new Set(), this.dynamicImporters = [], this.dynamicImports = [], this.execIndex = 1 / 0, this.implicitlyLoadedAfter = /* @__PURE__ */ new Set(), this.implicitlyLoadedBefore = /* @__PURE__ */ new Set(), this.importDescriptions = /* @__PURE__ */ new Map(), this.importMetas = [], this.importedFromNotTreeshaken = false, this.importers = [], this.includedDynamicImporters = [], this.includedImports = /* @__PURE__ */ new Set(), this.isExecuted = false, this.isUserDefinedEntryPoint = false, this.needsExportShim = false, this.sideEffectDependenciesByVariable = /* @__PURE__ */ new Map(), this.sourcesWithAttributes = /* @__PURE__ */ new Map(), this.allExportNames = null, this.ast = null, this.exportAllModules = [], this.exportAllSources = /* @__PURE__ */ new Set(), this.exportNamesByVariable = null, this.exportShimVariable = new Ca(this), this.exports = /* @__PURE__ */ new Map(), this.namespaceReexportsByName = /* @__PURE__ */ new Map(), this.reexportDescriptions = /* @__PURE__ */ new Map(), this.relevantDependencies = null, this.syntheticExports = /* @__PURE__ */ new Map(), this.syntheticNamespace = null, this.transformDependencies = [], this.transitiveReexports = null, this.excludeFromSourcemap = /\0/.test(t2), this.context = n2.moduleContext(t2), this.preserveSignature = this.options.preserveEntrySignatures;
    const l2 = this, { dynamicImports: c2, dynamicImporters: u2, exportAllSources: d2, exports: h2, implicitlyLoadedAfter: p2, implicitlyLoadedBefore: f2, importers: m2, reexportDescriptions: g2, sourcesWithAttributes: y2 } = this;
    this.info = { ast: null, attributes: a2, code: null, get dynamicallyImportedIdResolutions() {
      return c2.map(({ argument: e5 }) => "string" == typeof e5 && l2.resolvedIds[e5]).filter(Boolean);
    }, get dynamicallyImportedIds() {
      return c2.map(({ id: e5 }) => e5).filter((e5) => null != e5);
    }, get dynamicImporters() {
      return u2.sort();
    }, get exportedBindings() {
      const e5 = { ".": [...h2.keys()] };
      for (const [t3, { source: n3 }] of g2)
        (e5[n3] ?? (e5[n3] = [])).push(t3);
      for (const t3 of d2)
        (e5[t3] ?? (e5[t3] = [])).push("*");
      return e5;
    }, get exports() {
      return [...h2.keys(), ...g2.keys(), ...[...d2].map(() => "*")];
    }, get hasDefaultExport() {
      return l2.ast ? l2.exports.has("default") || g2.has("default") : null;
    }, id: t2, get implicitlyLoadedAfterOneOf() {
      return Array.from(p2, Ba).sort();
    }, get implicitlyLoadedBefore() {
      return Array.from(f2, Ba).sort();
    }, get importedIdResolutions() {
      return Array.from(y2.keys(), (e5) => l2.resolvedIds[e5]).filter(Boolean);
    }, get importedIds() {
      return Array.from(y2.keys(), (e5) => {
        var _a3;
        return (_a3 = l2.resolvedIds[e5]) == null ? void 0 : _a3.id;
      }).filter(Boolean);
    }, get importers() {
      return m2.sort();
    }, isEntry: s2, isExternal: false, get isIncluded() {
      return e4.phase !== Ma.GENERATE ? null : l2.isIncluded();
    }, meta: { ...o2 }, moduleSideEffects: i2, syntheticNamedExports: r2 };
  }
  basename() {
    const e4 = I(this.id), t2 = N(this.id);
    return Ce(t2 ? e4.slice(0, -t2.length) : e4);
  }
  bindReferences() {
    this.ast.bind();
  }
  cacheInfoGetters() {
    Pe(this.info, ["dynamicallyImportedIdResolutions", "dynamicallyImportedIds", "dynamicImporters", "exportedBindings", "exports", "hasDefaultExport", "implicitlyLoadedAfterOneOf", "implicitlyLoadedBefore", "importedIdResolutions", "importedIds", "importers"]);
  }
  error(e4, t2) {
    return void 0 !== t2 && this.addLocationToLogProps(e4, t2), lt(e4);
  }
  estimateSize() {
    let e4 = 0;
    for (const t2 of this.ast.body)
      t2.included && (e4 += t2.end - t2.start);
    return e4;
  }
  getAllExportNames() {
    if (this.allExportNames)
      return this.allExportNames;
    this.allExportNames = /* @__PURE__ */ new Set([...this.exports.keys(), ...this.reexportDescriptions.keys()]);
    for (const e4 of this.exportAllModules)
      if (e4 instanceof En)
        this.allExportNames.add(`*${e4.id}`);
      else
        for (const t2 of e4.getAllExportNames())
          "default" !== t2 && this.allExportNames.add(t2);
    return "string" == typeof this.info.syntheticNamedExports && this.allExportNames.delete(this.info.syntheticNamedExports), this.allExportNames;
  }
  getDependenciesToBeIncluded() {
    if (this.relevantDependencies)
      return this.relevantDependencies;
    this.relevantDependencies = /* @__PURE__ */ new Set();
    const e4 = /* @__PURE__ */ new Set(), t2 = /* @__PURE__ */ new Set(), n2 = new Set(this.includedImports);
    if (this.info.isEntry || this.includedDynamicImporters.length > 0 || this.namespace.included || this.implicitlyLoadedAfter.size > 0)
      for (const e5 of [...this.getReexports(), ...this.getExports()]) {
        const [t3] = this.getVariableForExportName(e5);
        (t3 == null ? void 0 : t3.included) && n2.add(t3);
      }
    for (let s2 of n2) {
      const n3 = this.sideEffectDependenciesByVariable.get(s2);
      if (n3)
        for (const e5 of n3)
          t2.add(e5);
      s2 instanceof Da ? s2 = s2.getBaseVariable() : s2 instanceof ha && (s2 = s2.getOriginalVariable()), e4.add(s2.module);
    }
    if (this.options.treeshake && "no-treeshake" !== this.info.moduleSideEffects)
      this.addRelevantSideEffectDependencies(this.relevantDependencies, e4, t2);
    else
      for (const e5 of this.dependencies)
        this.relevantDependencies.add(e5);
    for (const t3 of e4)
      this.relevantDependencies.add(t3);
    return this.relevantDependencies;
  }
  getExportNamesByVariable() {
    if (this.exportNamesByVariable)
      return this.exportNamesByVariable;
    const e4 = /* @__PURE__ */ new Map();
    for (const t2 of this.getAllExportNames()) {
      let [n2] = this.getVariableForExportName(t2);
      if (n2 instanceof ha && (n2 = n2.getOriginalVariable()), !n2 || !(n2.included || n2 instanceof $e))
        continue;
      const s2 = e4.get(n2);
      s2 ? s2.push(t2) : e4.set(n2, [t2]);
    }
    return this.exportNamesByVariable = e4;
  }
  getExports() {
    return [...this.exports.keys()];
  }
  getReexports() {
    if (this.transitiveReexports)
      return this.transitiveReexports;
    this.transitiveReexports = [];
    const e4 = new Set(this.reexportDescriptions.keys());
    for (const t2 of this.exportAllModules)
      if (t2 instanceof En)
        e4.add(`*${t2.id}`);
      else
        for (const n2 of [...t2.getReexports(), ...t2.getExports()])
          "default" !== n2 && e4.add(n2);
    return this.transitiveReexports = [...e4];
  }
  getRenderedExports() {
    const e4 = [], t2 = [];
    for (const n2 of this.exports.keys()) {
      const [s2] = this.getVariableForExportName(n2);
      ((s2 == null ? void 0 : s2.included) ? e4 : t2).push(n2);
    }
    return { removedExports: t2, renderedExports: e4 };
  }
  getSyntheticNamespace() {
    return null === this.syntheticNamespace && (this.syntheticNamespace = void 0, [this.syntheticNamespace] = this.getVariableForExportName("string" == typeof this.info.syntheticNamedExports ? this.info.syntheticNamedExports : "default", { onlyExplicit: true })), this.syntheticNamespace ? this.syntheticNamespace : lt((e4 = this.id, t2 = this.info.syntheticNamedExports, { code: "SYNTHETIC_NAMED_EXPORTS_NEED_NAMESPACE_EXPORT", exporter: e4, message: `Module "${B(e4)}" that is marked with \`syntheticNamedExports: ${JSON.stringify(t2)}\` needs ${"string" == typeof t2 && "default" !== t2 ? `an explicit export named "${t2}"` : "a default export"} that does not reexport an unresolved named export of the same module.` }));
    var e4, t2;
  }
  getVariableForExportName(e4, { importerForSideEffects: t2, isExportAllSearch: n2, onlyExplicit: s2, searchedNamesAndModules: i2 } = Se) {
    if ("*" === e4[0]) {
      if (1 === e4.length)
        return [this.namespace];
      return this.graph.modulesById.get(e4.slice(1)).getVariableForExportName("*");
    }
    const r2 = this.reexportDescriptions.get(e4);
    if (r2) {
      const [e5] = nl(r2.module, r2.localName, t2, false, i2);
      return e5 ? (t2 && (rl(e5, t2, this), this.info.moduleSideEffects && j(t2.sideEffectDependenciesByVariable, e5, U).add(this)), [e5]) : this.error(an(r2.localName, this.id, r2.module.id), r2.start);
    }
    const o2 = this.exports.get(e4);
    if (o2) {
      if (o2 === tl)
        return [this.exportShimVariable];
      const e5 = o2.localName, n3 = this.traceVariable(e5, { importerForSideEffects: t2, searchedNamesAndModules: i2 });
      return t2 && (rl(n3, t2, this), j(t2.sideEffectDependenciesByVariable, n3, U).add(this)), [n3];
    }
    if (s2)
      return [null];
    if ("default" !== e4) {
      const n3 = this.namespaceReexportsByName.get(e4) ?? this.getVariableFromNamespaceReexports(e4, t2, i2);
      if (this.namespaceReexportsByName.set(e4, n3), n3[0])
        return n3;
    }
    return this.info.syntheticNamedExports ? [j(this.syntheticExports, e4, () => new Da(this.astContext, e4, this.getSyntheticNamespace()))] : !n2 && this.options.shimMissingExports ? (this.shimMissingExport(e4), [this.exportShimVariable]) : [null];
  }
  hasEffects() {
    return "no-treeshake" === this.info.moduleSideEffects || this.ast.hasCachedEffects();
  }
  include() {
    const e4 = Fn();
    this.ast.shouldBeIncluded(e4) && this.ast.include(e4, false);
  }
  includeAllExports(e4) {
    this.isExecuted || (el(this), this.graph.needsTreeshakingPass = true);
    for (const s2 of this.exports.keys())
      if (e4 || s2 !== this.info.syntheticNamedExports) {
        const e5 = this.getVariableForExportName(s2)[0];
        if (!e5)
          return lt((t2 = s2, n2 = this.id, { binding: t2, code: Ot, exporter: n2, message: `Exported variable "${t2}" is not defined in "${B(n2)}".`, url: Ke(Ye) }));
        e5.deoptimizePath(J), e5.included || this.includeVariable(e5);
      }
    var t2, n2;
    for (const e5 of this.getReexports()) {
      const [t3] = this.getVariableForExportName(e5);
      t3 && (t3.deoptimizePath(J), t3.included || this.includeVariable(t3), t3 instanceof $e && (t3.module.reexported = true));
    }
    e4 && this.namespace.setMergedNamespaces(this.includeAndGetAdditionalMergedNamespaces());
  }
  includeAllInBundle() {
    this.ast.include(Fn(), true), this.includeAllExports(false);
  }
  includeExportsByNames(e4) {
    this.isExecuted || (el(this), this.graph.needsTreeshakingPass = true);
    let t2 = false;
    for (const n2 of e4) {
      const e5 = this.getVariableForExportName(n2)[0];
      e5 && (e5.deoptimizePath(J), e5.included || this.includeVariable(e5)), this.exports.has(n2) || this.reexportDescriptions.has(n2) || (t2 = true);
    }
    t2 && this.namespace.setMergedNamespaces(this.includeAndGetAdditionalMergedNamespaces());
  }
  isIncluded() {
    return this.ast && (this.ast.included || this.namespace.included || this.importedFromNotTreeshaken || this.exportShimVariable.included);
  }
  linkImports() {
    this.addModulesToImportDescriptions(this.importDescriptions), this.addModulesToImportDescriptions(this.reexportDescriptions);
    const e4 = [];
    for (const t2 of this.exportAllSources) {
      const n2 = this.graph.modulesById.get(this.resolvedIds[t2].id);
      n2 instanceof En ? e4.push(n2) : this.exportAllModules.push(n2);
    }
    this.exportAllModules.push(...e4);
  }
  log(e4, t2, n2) {
    this.addLocationToLogProps(t2, n2), this.options.onLog(e4, t2);
  }
  render(e4) {
    const t2 = this.magicString.clone();
    this.ast.render(t2, e4), t2.trim();
    const { usesTopLevelAwait: n2 } = this.astContext;
    return n2 && "es" !== e4.format && "system" !== e4.format ? lt((s2 = this.id, i2 = e4.format, { code: "INVALID_TLA_FORMAT", id: s2, message: `Module format "${i2}" does not support top-level await. Use the "es" or "system" output formats rather.` })) : { source: t2, usesTopLevelAwait: n2 };
    var s2, i2;
  }
  async setSource({ ast: e4, code: t2, customTransformCache: n2, originalCode: s2, originalSourcemap: i2, resolvedIds: r2, sourcemapChain: o2, transformDependencies: a2, transformFiles: l2, ...c2 }) {
    if (Ja("generate ast", 3), t2.startsWith("#!")) {
      const e5 = t2.indexOf("\n");
      this.shebang = t2.slice(2, e5);
    }
    this.info.code = t2, this.originalCode = s2, this.originalSourcemap = La(i2), this.sourcemapChain = o2.map((e5) => e5.missing ? e5 : La(e5)), _a2(this.originalSourcemap, this.sourcemapChain), l2 && (this.transformFiles = l2), this.transformDependencies = a2, this.customTransformCache = n2, this.updateOptions(c2), this.resolvedIds = r2 ?? /* @__PURE__ */ Object.create(null);
    const u2 = this.id;
    this.magicString = new g(t2, { filename: this.excludeFromSourcemap ? null : u2, indentExclusionRanges: [] }), this.astContext = { addDynamicImport: this.addDynamicImport.bind(this), addExport: this.addExport.bind(this), addImport: this.addImport.bind(this), addImportMeta: this.addImportMeta.bind(this), code: t2, deoptimizationTracker: this.graph.deoptimizationTracker, error: this.error.bind(this), fileName: u2, getExports: this.getExports.bind(this), getModuleExecIndex: () => this.execIndex, getModuleName: this.basename.bind(this), getNodeConstructor: (e5) => ka[e5] || ka.UnknownNode, getReexports: this.getReexports.bind(this), importDescriptions: this.importDescriptions, includeAllExports: () => this.includeAllExports(true), includeDynamicImport: this.includeDynamicImport.bind(this), includeVariableInModule: this.includeVariableInModule.bind(this), log: this.log.bind(this), magicString: this.magicString, manualPureFunctions: this.graph.pureFunctions, module: this, moduleContext: this.context, options: this.options, requestTreeshakingPass: () => this.graph.needsTreeshakingPass = true, traceExport: (e5) => this.getVariableForExportName(e5)[0], traceVariable: this.traceVariable.bind(this), usesTopLevelAwait: false }, this.scope = new pa(this.graph.scope, this.astContext), this.namespace = new Oa(this.astContext);
    const d2 = { context: this.astContext, type: "Module" };
    if (e4)
      this.ast = new ka[e4.type](d2, this.scope).parseNode(e4), this.info.ast = e4;
    else {
      Xa("generate ast", 3);
      const e5 = await async function(e6, t3, n3) {
        return Bn(e6, t3);
      }(t2, false);
      Ja("generate ast", 3), this.ast = (h2 = e5, p2 = d2, f2 = this.scope, Pa(p2, f2, 0, new Uint32Array(h2.buffer), Zn(h2))), Object.defineProperty(this.info, "ast", { get: () => {
        if (this.graph.astLru.has(u2))
          return this.graph.astLru.get(u2);
        {
          const e6 = this.tryParse();
          return false !== this.options.cache ? (Object.defineProperty(this.info, "ast", { value: e6 }), e6) : (this.graph.astLru.set(u2, e6), e6);
        }
      } });
    }
    var h2, p2, f2;
    Xa("generate ast", 3);
  }
  toJSON() {
    return { ast: this.info.ast, attributes: this.info.attributes, code: this.info.code, customTransformCache: this.customTransformCache, dependencies: Array.from(this.dependencies, Ba), id: this.id, meta: this.info.meta, moduleSideEffects: this.info.moduleSideEffects, originalCode: this.originalCode, originalSourcemap: this.originalSourcemap, resolvedIds: this.resolvedIds, sourcemapChain: this.sourcemapChain, syntheticNamedExports: this.info.syntheticNamedExports, transformDependencies: this.transformDependencies, transformFiles: this.transformFiles };
  }
  traceVariable(e4, { importerForSideEffects: t2, isExportAllSearch: n2, searchedNamesAndModules: s2 } = Se) {
    const i2 = this.scope.variables.get(e4);
    if (i2)
      return i2;
    const r2 = this.importDescriptions.get(e4);
    if (r2) {
      const e5 = r2.module;
      if (e5 instanceof il && "*" === r2.name)
        return e5.namespace;
      const [i3] = nl(e5, r2.name, t2 || this, n2, s2);
      return i3 || this.error(an(r2.name, this.id, e5.id), r2.start);
    }
    return null;
  }
  updateOptions({ meta: e4, moduleSideEffects: t2, syntheticNamedExports: n2 }) {
    null != t2 && (this.info.moduleSideEffects = t2), null != n2 && (this.info.syntheticNamedExports = n2), null != e4 && Object.assign(this.info.meta, e4);
  }
  addDynamicImport(e4) {
    let t2 = e4.sourceAstNode;
    "TemplateLiteral" === t2.type ? 1 === t2.quasis.length && "string" == typeof t2.quasis[0].value.cooked && (t2 = t2.quasis[0].value.cooked) : "Literal" === t2.type && "string" == typeof t2.value && (t2 = t2.value), this.dynamicImports.push({ argument: t2, id: null, node: e4, resolution: null });
  }
  assertUniqueExportName(e4, t2) {
    (this.exports.has(e4) || this.reexportDescriptions.has(e4)) && this.error(function(e5) {
      return { code: "DUPLICATE_EXPORT", message: `Duplicate export "${e5}"` };
    }(e4), t2);
  }
  addExport(e4) {
    if (e4 instanceof Lr)
      this.assertUniqueExportName("default", e4.start), this.exports.set("default", { identifier: e4.variable.getAssignedVariableName(), localName: "default" });
    else if (e4 instanceof Rr) {
      const t2 = e4.source.value;
      if (this.addSource(t2, e4), e4.exported) {
        const n2 = e4.exported instanceof cr ? e4.exported.value : e4.exported.name;
        this.assertUniqueExportName(n2, e4.exported.start), this.reexportDescriptions.set(n2, { localName: "*", module: null, source: t2, start: e4.start });
      } else
        this.exportAllSources.add(t2);
    } else if (e4.source instanceof cr) {
      const t2 = e4.source.value;
      this.addSource(t2, e4);
      for (const { exported: n2, local: s2, start: i2 } of e4.specifiers) {
        const e5 = n2 instanceof cr ? n2.value : n2.name;
        this.assertUniqueExportName(e5, i2), this.reexportDescriptions.set(e5, { localName: s2 instanceof cr ? s2.value : s2.name, module: null, source: t2, start: i2 });
      }
    } else if (e4.declaration) {
      const t2 = e4.declaration;
      if (t2 instanceof xa)
        for (const e5 of t2.declarations)
          for (const t3 of $n(e5.id))
            this.assertUniqueExportName(t3, e5.id.start), this.exports.set(t3, { identifier: null, localName: t3 });
      else {
        const e5 = t2.id.name;
        this.assertUniqueExportName(e5, t2.id.start), this.exports.set(e5, { identifier: null, localName: e5 });
      }
    } else
      for (const { local: t2, exported: n2 } of e4.specifiers) {
        const e5 = t2.name, s2 = n2 instanceof gi ? n2.name : n2.value;
        this.assertUniqueExportName(s2, n2.start), this.exports.set(s2, { identifier: null, localName: e5 });
      }
  }
  addImport(e4) {
    const t2 = e4.source.value;
    this.addSource(t2, e4);
    for (const n2 of e4.specifiers) {
      const e5 = n2.local.name;
      (this.scope.variables.has(e5) || this.importDescriptions.has(e5)) && this.error(dn(e5), n2.local.start);
      const s2 = n2 instanceof Kr ? "default" : n2 instanceof Co ? "*" : n2.imported instanceof gi ? n2.imported.name : n2.imported.value;
      this.importDescriptions.set(e5, { module: null, name: s2, source: t2, start: n2.start });
    }
  }
  addImportMeta(e4) {
    this.importMetas.push(e4);
  }
  addLocationToLogProps(e4, t2) {
    e4.id = this.id, e4.pos = t2;
    let n2 = this.info.code;
    const s2 = Fe(n2, t2, { offsetLine: 1 });
    if (s2) {
      let { column: i2, line: r2 } = s2;
      try {
        ({ column: i2, line: r2 } = function(e5, t3) {
          const n3 = e5.filter((e6) => !e6.missing);
          e:
            for (; n3.length > 0; ) {
              const e6 = n3.pop().mappings[t3.line - 1];
              if (e6) {
                const n4 = e6.filter((e7) => e7.length > 1), s3 = n4[n4.length - 1];
                for (const e7 of n4)
                  if (e7[0] >= t3.column || e7 === s3) {
                    t3 = { column: e7[3], line: e7[2] + 1 };
                    continue e;
                  }
              }
              throw new Error("Can't resolve original location of error.");
            }
          return t3;
        }(this.sourcemapChain, { column: i2, line: r2 })), n2 = this.originalCode;
      } catch (e5) {
        this.options.onLog(Le, function(e6, t3, n3, s3, i3) {
          return { cause: e6, code: "SOURCEMAP_ERROR", id: t3, loc: { column: n3, file: t3, line: s3 }, message: `Error when using sourcemap for reporting an error: ${e6.message}`, pos: i3 };
        }(e5, this.id, i2, r2, t2));
      }
      ut(e4, { column: i2, line: r2 }, n2, this.id);
    }
  }
  addModulesToImportDescriptions(e4) {
    for (const t2 of e4.values()) {
      const { id: e5 } = this.resolvedIds[t2.source];
      t2.module = this.graph.modulesById.get(e5);
    }
  }
  addRelevantSideEffectDependencies(e4, t2, n2) {
    const s2 = /* @__PURE__ */ new Set(), i2 = (r2) => {
      for (const o2 of r2)
        s2.has(o2) || (s2.add(o2), t2.has(o2) ? e4.add(o2) : (o2.info.moduleSideEffects || n2.has(o2)) && (o2 instanceof En || o2.hasEffects() ? e4.add(o2) : i2(o2.dependencies)));
    };
    i2(this.dependencies), i2(n2);
  }
  addSource(e4, t2) {
    const n2 = (s2 = t2.attributes, (s2 == null ? void 0 : s2.length) ? Object.fromEntries(s2.map((e5) => [Fa(e5), e5.value.value])) : Se);
    var s2;
    const i2 = this.sourcesWithAttributes.get(e4);
    i2 ? ja(i2, n2) && this.log(Le, en(i2, n2, e4, this.id), t2.start) : this.sourcesWithAttributes.set(e4, n2);
  }
  getVariableFromNamespaceReexports(e4, t2, n2) {
    let s2 = null;
    const i2 = /* @__PURE__ */ new Map(), r2 = /* @__PURE__ */ new Set();
    for (const o3 of this.exportAllModules) {
      if (o3.info.syntheticNamedExports === e4)
        continue;
      const [a3, l3] = nl(o3, e4, t2, true, ol(n2));
      o3 instanceof En || l3 ? r2.add(a3) : a3 instanceof Da ? s2 || (s2 = a3) : a3 && i2.set(a3, o3);
    }
    if (i2.size > 0) {
      const t3 = [...i2], n3 = t3[0][0];
      return 1 === t3.length ? [n3] : (this.options.onLog(Le, (o2 = e4, a2 = this.id, l2 = t3.map(([, e5]) => e5.id), { binding: o2, code: "NAMESPACE_CONFLICT", ids: l2, message: `Conflicting namespaces: "${B(a2)}" re-exports "${o2}" from one of the modules ${He(l2.map((e5) => B(e5)))} (will be ignored).`, reexporter: a2 })), [null]);
    }
    var o2, a2, l2;
    if (r2.size > 0) {
      const t3 = [...r2], n3 = t3[0];
      return t3.length > 1 && this.options.onLog(Le, function(e5, t4, n4, s3) {
        return { binding: e5, code: "AMBIGUOUS_EXTERNAL_NAMESPACES", ids: s3, message: `Ambiguous external namespace resolution: "${B(t4)}" re-exports "${e5}" from one of the external modules ${He(s3.map((e6) => B(e6)))}, guessing "${B(n4)}".`, reexporter: t4 };
      }(e4, this.id, n3.module.id, t3.map((e5) => e5.module.id))), [n3, true];
    }
    return s2 ? [s2] : [null];
  }
  includeAndGetAdditionalMergedNamespaces() {
    const e4 = /* @__PURE__ */ new Set(), t2 = /* @__PURE__ */ new Set();
    for (const n2 of [this, ...this.exportAllModules])
      if (n2 instanceof En) {
        const [t3] = n2.getVariableForExportName("*");
        t3.include(), this.includedImports.add(t3), e4.add(t3);
      } else if (n2.info.syntheticNamedExports) {
        const e5 = n2.getSyntheticNamespace();
        e5.include(), this.includedImports.add(e5), t2.add(e5);
      }
    return [...t2, ...e4];
  }
  includeDynamicImport(e4) {
    const t2 = this.dynamicImports.find((t3) => t3.node === e4).resolution;
    if (t2 instanceof il) {
      t2.includedDynamicImporters.push(this);
      const n2 = this.options.treeshake ? e4.getDeterministicImportedNames() : void 0;
      n2 ? t2.includeExportsByNames(n2) : t2.includeAllExports(true);
    }
  }
  includeVariable(e4) {
    const t2 = e4.module;
    if (e4.included)
      t2 instanceof il && t2 !== this && sl(e4, this);
    else if (e4.include(), this.graph.needsTreeshakingPass = true, t2 instanceof il && (t2.isExecuted || el(t2), t2 !== this)) {
      const t3 = sl(e4, this);
      for (const e5 of t3)
        e5.isExecuted || el(e5);
    }
  }
  includeVariableInModule(e4) {
    this.includeVariable(e4);
    const t2 = e4.module;
    t2 && t2 !== this && this.includedImports.add(e4);
  }
  shimMissingExport(e4) {
    var t2, n2;
    this.options.onLog(Le, (t2 = this.id, { binding: n2 = e4, code: "SHIMMED_EXPORT", exporter: t2, message: `Missing export "${n2}" has been shimmed in module "${B(t2)}".` })), this.exports.set(e4, tl);
  }
  tryParse() {
    try {
      return Ta(this.info.code);
    } catch (e4) {
      return this.error(hn(e4, this.id), e4.pos);
    }
  }
}
function rl(e4, t2, n2) {
  if (e4.module instanceof il && e4.module !== n2) {
    const s2 = e4.module.cycles;
    if (s2.size > 0) {
      const i2 = n2.cycles;
      for (const r2 of i2)
        if (s2.has(r2)) {
          t2.alternativeReexportModules.set(e4, n2);
          break;
        }
    }
  }
}
const ol = (e4) => e4 && new Map(Array.from(e4, ([e5, t2]) => [e5, new Set(t2)]));
function al(e4) {
  return e4.endsWith(".js") ? e4.slice(0, -3) : e4;
}
function ll(e4, t2) {
  return e4.autoId ? `${e4.basePath ? e4.basePath + "/" : ""}${al(t2)}` : e4.id ?? "";
}
function cl(e4, t2, n2, s2, i2, r2, o2, a2, l2 = "return ") {
  const { _: c2, getDirectReturnFunction: u2, getFunctionIntro: d2, getPropertyAccess: h2, n: p2, s: f2 } = i2;
  if (!n2)
    return `${p2}${p2}${l2}${function(e5, t3, n3, s3, i3) {
      if (e5.length > 0)
        return e5[0].local;
      for (const { defaultVariableName: e6, importPath: r3, isChunk: o3, name: a3, namedExportsMode: l3, namespaceVariableName: c3, reexports: u3 } of t3)
        if (u3)
          return ul(a3, u3[0].imported, l3, o3, e6, c3, n3, r3, s3, i3);
    }(e4, t2, s2, o2, h2)};`;
  let m2 = "";
  for (const { defaultVariableName: e5, importPath: i3, isChunk: a3, name: l3, namedExportsMode: d3, namespaceVariableName: f3, reexports: g2 } of t2)
    if (g2 && n2) {
      for (const t3 of g2)
        if ("*" !== t3.reexported) {
          const n3 = ul(l3, t3.imported, d3, a3, e5, f3, s2, i3, o2, h2);
          if (m2 && (m2 += p2), "*" !== t3.imported && t3.needsLiveBinding) {
            const [e6, s3] = u2([], { functionReturn: true, lineBreakIndent: null, name: null });
            m2 += `Object.defineProperty(exports,${c2}${JSON.stringify(t3.reexported)},${c2}{${p2}${r2}enumerable:${c2}true,${p2}${r2}get:${c2}${e6}${n3}${s3}${p2}});`;
          } else
            "__proto__" === t3.reexported ? m2 += `Object.defineProperty(exports,${c2}"__proto__",${c2}{${p2}${r2}enumerable:${c2}true,${p2}${r2}value:${c2}${n3}${p2}});` : m2 += `exports${h2(t3.reexported)}${c2}=${c2}${n3};`;
        }
    }
  for (const { exported: t3, local: n3 } of e4) {
    const e5 = `exports${h2(t3)}`;
    e5 !== n3 && (m2 && (m2 += p2), m2 += "__proto__" === t3 ? `Object.defineProperty(exports,${c2}"__proto__",${c2}{${p2}${r2}enumerable:${c2}true,${p2}${r2}value:${c2}${n3}${p2}});` : `${e5}${c2}=${c2}${n3};`);
  }
  for (const { name: e5, reexports: s3 } of t2)
    if (s3 && n2) {
      for (const t3 of s3)
        if ("*" === t3.reexported) {
          if (m2 && (m2 += p2), !t3.needsLiveBinding && a2) {
            const t4 = "'__proto__'";
            m2 += `Object.prototype.hasOwnProperty.call(${e5},${c2}${t4})${c2}&&${p2}${r2}!Object.prototype.hasOwnProperty.call(exports,${c2}${t4})${c2}&&${p2}${r2}Object.defineProperty(exports,${c2}${t4},${c2}{${p2}${r2}${r2}enumerable:${c2}true,${p2}${r2}${r2}value:${c2}${e5}[${t4}]${p2}${r2}});${p2}${p2}`;
          }
          const n3 = `{${p2}${r2}if${c2}(k${c2}!==${c2}'default'${c2}&&${c2}!Object.prototype.hasOwnProperty.call(exports,${c2}k))${c2}${pl(e5, t3.needsLiveBinding, r2, i2)}${f2}${p2}}`;
          m2 += `Object.keys(${e5}).forEach(${d2(["k"], { isAsync: false, name: null })}${n3});`;
        }
    }
  return m2 ? `${p2}${p2}${m2}` : "";
}
function ul(e4, t2, n2, s2, i2, r2, o2, a2, l2, c2) {
  if ("default" === t2) {
    if (!s2) {
      const t3 = o2(a2), n3 = so[t3] ? i2 : e4;
      return io(t3, l2) ? `${n3}${c2("default")}` : n3;
    }
    return n2 ? `${e4}${c2("default")}` : e4;
  }
  return "*" === t2 ? (s2 ? !n2 : ro[o2(a2)]) ? r2 : e4 : `${e4}${c2(t2)}`;
}
function dl(e4) {
  return e4([["value", "true"]], { lineBreakIndent: null });
}
function hl(e4, t2, n2, { _: s2, getObject: i2 }) {
  if (e4) {
    if (t2)
      return n2 ? `Object.defineProperties(exports,${s2}${i2([["__esModule", dl(i2)], [null, `[Symbol.toStringTag]:${s2}${So(i2)}`]], { lineBreakIndent: null })});` : `Object.defineProperty(exports,${s2}'__esModule',${s2}${dl(i2)});`;
    if (n2)
      return `Object.defineProperty(exports,${s2}Symbol.toStringTag,${s2}${So(i2)});`;
  }
  return "";
}
const pl = (e4, t2, n2, { _: s2, getDirectReturnFunction: i2, n: r2 }) => {
  if (t2) {
    const [t3, o2] = i2([], { functionReturn: true, lineBreakIndent: null, name: null });
    return `Object.defineProperty(exports,${s2}k,${s2}{${r2}${n2}${n2}enumerable:${s2}true,${r2}${n2}${n2}get:${s2}${t3}${e4}[k]${o2}${r2}${n2}})`;
  }
  return `exports[k]${s2}=${s2}${e4}[k]`;
};
function fl(e4, t2, n2, s2, i2, r2, o2, a2) {
  const { _: l2, cnst: c2, n: u2 } = a2, d2 = /* @__PURE__ */ new Set(), h2 = [], p2 = (e5, t3, n3) => {
    d2.add(t3), h2.push(`${c2} ${e5}${l2}=${l2}/*#__PURE__*/${t3}(${n3});`);
  };
  for (const { defaultVariableName: n3, imports: s3, importPath: i3, isChunk: r3, name: o3, namedExportsMode: a3, namespaceVariableName: l3, reexports: c3 } of e4)
    if (r3) {
      for (const { imported: e5, reexported: t3 } of [...s3 || [], ...c3 || []])
        if ("*" === e5 && "*" !== t3) {
          a3 || p2(l3, eo, o3);
          break;
        }
    } else {
      const e5 = t2(i3);
      let r4 = false, a4 = false;
      for (const { imported: t3, reexported: i4 } of [...s3 || [], ...c3 || []]) {
        let s4, c4;
        "default" === t3 ? r4 || (r4 = true, n3 !== l3 && (c4 = n3, s4 = so[e5])) : "*" !== t3 || "*" === i4 || a4 || (a4 = true, s4 = ro[e5], c4 = l3), s4 && p2(c4, s4, o3);
      }
    }
  return `${ao(d2, r2, o2, a2, n2, s2, i2)}${h2.length > 0 ? `${h2.join(u2)}${u2}${u2}` : ""}`;
}
function ml(e4, t2) {
  return "." !== e4[0] ? e4 : t2 ? (n2 = e4).endsWith(".js") ? n2 : n2 + ".js" : al(e4);
  var n2;
}
const gl = /* @__PURE__ */ new Set(["assert", "assert/strict", "async_hooks", "buffer", "child_process", "cluster", "console", "constants", "crypto", "dgram", "diagnostics_channel", "dns", "dns/promises", "domain", "events", "fs", "fs/promises", "http", "http2", "https", "inspector", "inspector/promises", "module", "net", "os", "path", "path/posix", "path/win32", "perf_hooks", "process", "punycode", "querystring", "readline", "readline/promises", "repl", "stream", "stream/consumers", "stream/promises", "stream/web", "string_decoder", "timers", "timers/promises", "tls", "trace_events", "tty", "url", "util", "util/types", "v8", "vm", "wasi", "worker_threads", "zlib"]);
function yl(e4, t2) {
  const n2 = t2.map(({ importPath: e5 }) => e5).filter((e5) => gl.has(e5) || e5.startsWith("node:"));
  0 !== n2.length && e4(Le, function(e5) {
    return { code: _t, ids: e5, message: `Creating a browser bundle that depends on Node.js built-in modules (${He(e5)}). You might need to include https://github.com/FredKSchott/rollup-plugin-polyfill-node` };
  }(n2));
}
const bl = (e4, t2) => e4.split(".").map(t2).join("");
function El(e4, t2, n2, s2, { _: i2, getPropertyAccess: r2 }) {
  const o2 = e4.split(".");
  o2[0] = ("function" == typeof n2 ? n2(o2[0]) : n2[o2[0]]) || o2[0];
  const a2 = o2.pop();
  let l2 = t2, c2 = [...o2.map((e5) => (l2 += r2(e5), `${l2}${i2}=${i2}${l2}${i2}||${i2}{}`)), `${l2}${r2(a2)}`].join(`,${i2}`) + `${i2}=${i2}${s2}`;
  return o2.length > 0 && (c2 = `(${c2})`), c2;
}
function xl(e4) {
  let t2 = e4.length;
  for (; t2--; ) {
    const { imports: n2, reexports: s2 } = e4[t2];
    if (n2 || s2)
      return e4.slice(0, t2 + 1);
  }
  return [];
}
const $l = ({ dependencies: e4, exports: t2 }) => {
  const n2 = new Set(t2.map((e5) => e5.exported));
  n2.add("default");
  for (const { reexports: t3 } of e4)
    if (t3)
      for (const e5 of t3)
        "*" !== e5.reexported && n2.add(e5.reexported);
  return n2;
}, Al = (e4, t2, { _: n2, cnst: s2, getObject: i2, n: r2 }) => {
  if (e4) {
    const o2 = [...e4].map((e5) => [e5, "1"]);
    return o2.unshift([null, `__proto__:${n2}null`]), `${r2}${t2}${s2} _starExcludes${n2}=${n2}${i2(o2, { lineBreakIndent: { base: t2, t: t2 } })};`;
  }
  return "";
}, Sl = (e4, t2, { _: n2, n: s2 }) => e4.length > 0 ? `${s2}${t2}var ${e4.join(`,${n2}`)};` : "", wl = (e4, t2, n2) => vl(e4.filter((e5) => e5.hoisted).map((e5) => ({ name: e5.exported, value: e5.local })), t2, n2);
function vl(e4, t2, { _: n2, n: s2 }) {
  return 0 === e4.length ? "" : 1 === e4.length ? `exports(${JSON.stringify(e4[0].name)},${n2}${e4[0].value});${s2}${s2}` : `exports({${s2}` + e4.map(({ name: e5, value: s3 }) => `${t2}${Me(e5)}:${n2}${s3}`).join(`,${s2}`) + `${s2}});${s2}${s2}`;
}
const Pl = (e4, t2, n2) => vl(e4.filter((e5) => e5.expression).map((e5) => ({ name: e5.exported, value: e5.local })), t2, n2), Il = (e4, t2, n2) => vl(e4.filter((e5) => e5.local === Na).map((e5) => ({ name: e5.exported, value: Na })), t2, n2);
function kl(e4, t2, n2) {
  return e4 ? `${t2}${bl(e4, n2)}` : "null";
}
var Nl = { amd: function(e4, { accessedGlobals: t2, dependencies: n2, exports: s2, hasDefaultExport: i2, hasExports: r2, id: o2, indent: a2, intro: l2, isEntryFacade: c2, isModuleFacade: u2, namedExportsMode: d2, log: h2, outro: p2, snippets: f2 }, { amd: m2, esModule: g2, externalLiveBindings: y2, freeze: b2, generatedCode: { symbols: E2 }, interop: x2, reexportProtoFromExternal: $2, strict: A2 }) {
  yl(h2, n2);
  const S2 = n2.map((e5) => `'${ml(e5.importPath, m2.forceJsExtensionForImports)}'`), w2 = n2.map((e5) => e5.name), { n: v2, getNonArrowFunctionIntro: P2, _: I2 } = f2;
  d2 && r2 && (w2.unshift("exports"), S2.unshift("'exports'")), t2.has("require") && (w2.unshift("require"), S2.unshift("'require'")), t2.has("module") && (w2.unshift("module"), S2.unshift("'module'"));
  const k2 = ll(m2, o2), N2 = (k2 ? `'${k2}',${I2}` : "") + (S2.length > 0 ? `[${S2.join(`,${I2}`)}],${I2}` : ""), C2 = A2 ? `${I2}'use strict';` : "";
  e4.prepend(`${l2}${fl(n2, x2, y2, b2, E2, t2, a2, f2)}`);
  const O2 = cl(s2, n2, d2, x2, f2, a2, y2, $2);
  let D2 = hl(d2 && r2, c2 && (true === g2 || "if-default-prop" === g2 && i2), u2 && E2, f2);
  D2 && (D2 = v2 + v2 + D2), e4.append(`${O2}${D2}${p2}`).indent(a2).prepend(`${m2.define}(${N2}(${P2(w2, { isAsync: false, name: null })}{${C2}${v2}${v2}`).append(`${v2}${v2}}));`);
}, cjs: function(e4, { accessedGlobals: t2, dependencies: n2, exports: s2, hasDefaultExport: i2, hasExports: r2, indent: o2, intro: a2, isEntryFacade: l2, isModuleFacade: c2, namedExportsMode: u2, outro: d2, snippets: h2 }, { compact: p2, esModule: f2, externalLiveBindings: m2, freeze: g2, interop: y2, generatedCode: { symbols: b2 }, reexportProtoFromExternal: E2, strict: x2 }) {
  const { _: $2, n: A2 } = h2, S2 = x2 ? `'use strict';${A2}${A2}` : "";
  let w2 = hl(u2 && r2, l2 && (true === f2 || "if-default-prop" === f2 && i2), c2 && b2, h2);
  w2 && (w2 += A2 + A2);
  const v2 = function(e5, { _: t3, cnst: n3, n: s3 }, i3) {
    let r3 = "", o3 = false;
    for (const { importPath: a3, name: l3, reexports: c3, imports: u3 } of e5)
      c3 || u3 ? (r3 += i3 && o3 ? "," : `${r3 ? `;${s3}` : ""}${n3} `, o3 = true, r3 += `${l3}${t3}=${t3}require('${a3}')`) : (r3 && (r3 += i3 && !o3 ? "," : `;${s3}`), o3 = false, r3 += `require('${a3}')`);
    if (r3)
      return `${r3};${s3}${s3}`;
    return "";
  }(n2, h2, p2), P2 = fl(n2, y2, m2, g2, b2, t2, o2, h2);
  e4.prepend(`${S2}${a2}${w2}${v2}${P2}`);
  const I2 = cl(s2, n2, u2, y2, h2, o2, m2, E2, `module.exports${$2}=${$2}`);
  e4.append(`${I2}${d2}`);
}, es: function(e4, { accessedGlobals: t2, indent: n2, intro: s2, outro: i2, dependencies: r2, exports: o2, snippets: a2 }, { externalLiveBindings: l2, freeze: c2, generatedCode: { symbols: u2 }, importAttributesKey: d2 }) {
  const { n: h2 } = a2, p2 = function(e5, t3, { _: n3 }) {
    const s3 = [];
    for (const { importPath: i3, reexports: r3, imports: o3, name: a3, attributes: l3 } of e5) {
      const e6 = `'${i3}'${l3 ? `${n3}${t3}${n3}${l3}` : ""};`;
      if (r3 || o3) {
        if (o3) {
          let t4 = null, i4 = null;
          const r4 = [];
          for (const e7 of o3)
            "default" === e7.imported ? t4 = e7 : "*" === e7.imported ? i4 = e7 : r4.push(e7);
          i4 && s3.push(`import${n3}*${n3}as ${i4.local} from${n3}${e6}`), t4 && 0 === r4.length ? s3.push(`import ${t4.local} from${n3}${e6}`) : r4.length > 0 && s3.push(`import ${t4 ? `${t4.local},${n3}` : ""}{${n3}${r4.map((e7) => e7.imported === e7.local ? e7.imported : `${Re(e7.imported)} as ${e7.local}`).join(`,${n3}`)}${n3}}${n3}from${n3}${e6}`);
        }
        if (r3) {
          let t4 = null;
          const i4 = [], l4 = [];
          for (const e7 of r3)
            "*" === e7.reexported ? t4 = e7 : "*" === e7.imported ? i4.push(e7) : l4.push(e7);
          if (t4 && s3.push(`export${n3}*${n3}from${n3}${e6}`), i4.length > 0) {
            o3 && o3.some((e7) => "*" === e7.imported && e7.local === a3) || s3.push(`import${n3}*${n3}as ${a3} from${n3}${e6}`);
            for (const e7 of i4)
              s3.push(`export${n3}{${n3}${a3 === e7.reexported ? a3 : `${a3} as ${Re(e7.reexported)}`} };`);
          }
          l4.length > 0 && s3.push(`export${n3}{${n3}${l4.map((e7) => e7.imported === e7.reexported ? Re(e7.imported) : `${Re(e7.imported)} as ${Re(e7.reexported)}`).join(`,${n3}`)}${n3}}${n3}from${n3}${e6}`);
        }
      } else
        s3.push(`import${n3}${e6}`);
    }
    return s3;
  }(r2, d2, a2);
  p2.length > 0 && (s2 += p2.join(h2) + h2 + h2), (s2 += ao(null, t2, n2, a2, l2, c2, u2)) && e4.prepend(s2);
  const f2 = function(e5, { _: t3, cnst: n3 }) {
    const s3 = [], i3 = [];
    for (const r3 of e5)
      r3.expression && s3.push(`${n3} ${r3.local}${t3}=${t3}${r3.expression};`), i3.push(r3.exported === r3.local ? r3.local : `${r3.local} as ${Re(r3.exported)}`);
    i3.length > 0 && s3.push(`export${t3}{${t3}${i3.join(`,${t3}`)}${t3}};`);
    return s3;
  }(o2, a2);
  f2.length > 0 && e4.append(h2 + h2 + f2.join(h2).trim()), i2 && e4.append(i2), e4.trim();
}, iife: function(e4, { accessedGlobals: t2, dependencies: n2, exports: s2, hasDefaultExport: i2, hasExports: r2, indent: o2, intro: a2, namedExportsMode: l2, log: c2, outro: u2, snippets: d2 }, { compact: h2, esModule: p2, extend: f2, freeze: m2, externalLiveBindings: g2, reexportProtoFromExternal: y2, globals: b2, interop: E2, name: x2, generatedCode: { symbols: $2 }, strict: A2 }) {
  const { _: S2, getNonArrowFunctionIntro: w2, getPropertyAccess: v2, n: P2 } = d2, I2 = x2 && x2.includes("."), k2 = !f2 && !I2;
  if (x2 && k2 && (Ne(N2 = x2) || ke.test(N2)))
    return lt(function(e5) {
      return { code: St, message: `Given name "${e5}" is not a legal JS identifier. If you need this, you can try "output.extend: true".`, url: Ke(et) };
    }(x2));
  var N2;
  yl(c2, n2);
  const C2 = xl(n2), O2 = C2.map((e5) => e5.globalName || "null"), D2 = C2.map((e5) => e5.name);
  r2 && !x2 && c2(Le, { code: Rt, message: 'If you do not supply "output.name", you may not be able to access the exports of an IIFE bundle.', url: Ke(ot) }), l2 && r2 && (f2 ? (O2.unshift(`this${bl(x2, v2)}${S2}=${S2}this${bl(x2, v2)}${S2}||${S2}{}`), D2.unshift("exports")) : (O2.unshift("{}"), D2.unshift("exports")));
  const M2 = A2 ? `${o2}'use strict';${P2}` : "", R2 = fl(n2, E2, g2, m2, $2, t2, o2, d2);
  e4.prepend(`${a2}${R2}`);
  let _2 = `(${w2(D2, { isAsync: false, name: null })}{${P2}${M2}${P2}`;
  r2 && (!x2 || f2 && l2 || (_2 = (k2 ? `var ${x2}` : `this${bl(x2, v2)}`) + `${S2}=${S2}${_2}`), I2 && (_2 = function(e5, t3, n3, { _: s3, getPropertyAccess: i3, s: r3 }, o3) {
    const a3 = e5.split(".");
    a3[0] = ("function" == typeof n3 ? n3(a3[0]) : n3[a3[0]]) || a3[0], a3.pop();
    let l3 = t3;
    return a3.map((e6) => (l3 += i3(e6), `${l3}${s3}=${s3}${l3}${s3}||${s3}{}${r3}`)).join(o3 ? "," : "\n") + (o3 && a3.length > 0 ? ";" : "\n");
  }(x2, "this", b2, d2, h2) + _2));
  let L2 = `${P2}${P2}})(${O2.join(`,${S2}`)});`;
  r2 && !f2 && l2 && (L2 = `${P2}${P2}${o2}return exports;${L2}`);
  const B2 = cl(s2, n2, l2, E2, d2, o2, g2, y2);
  let T2 = hl(l2 && r2, true === p2 || "if-default-prop" === p2 && i2, $2, d2);
  T2 && (T2 = P2 + P2 + T2), e4.append(`${B2}${T2}${u2}`).indent(o2).prepend(_2).append(L2);
}, system: function(e4, { accessedGlobals: t2, dependencies: n2, exports: s2, hasExports: i2, indent: r2, intro: o2, snippets: a2, outro: l2, usesTopLevelAwait: c2 }, { externalLiveBindings: u2, freeze: d2, name: h2, generatedCode: { symbols: p2 }, strict: f2, systemNullSetters: m2 }) {
  const { _: g2, getFunctionIntro: y2, getNonArrowFunctionIntro: b2, n: E2, s: x2 } = a2, { importBindings: $2, setters: A2, starExcludes: S2 } = function(e5, t3, n3, { _: s3, cnst: i3, getObject: r3, getPropertyAccess: o3, n: a3 }) {
    const l3 = [], c3 = [];
    let u3 = null;
    for (const { imports: d3, reexports: h3 } of e5) {
      const p3 = [];
      if (d3)
        for (const e6 of d3)
          l3.push(e6.local), "*" === e6.imported ? p3.push(`${e6.local}${s3}=${s3}module;`) : p3.push(`${e6.local}${s3}=${s3}module${o3(e6.imported)};`);
      if (h3) {
        const a4 = [];
        let l4 = false;
        for (const { imported: e6, reexported: t4 } of h3)
          "*" === t4 ? l4 = true : a4.push([t4, "*" === e6 ? "module" : `module${o3(e6)}`]);
        if (a4.length > 1 || l4)
          if (l4) {
            u3 || (u3 = $l({ dependencies: e5, exports: t3 })), a4.unshift([null, `__proto__:${s3}null`]);
            const o4 = r3(a4, { lineBreakIndent: null });
            p3.push(`${i3} setter${s3}=${s3}${o4};`, `for${s3}(${i3} name in module)${s3}{`, `${n3}if${s3}(!_starExcludes[name])${s3}setter[name]${s3}=${s3}module[name];`, "}", "exports(setter);");
          } else {
            const e6 = r3(a4, { lineBreakIndent: null });
            p3.push(`exports(${e6});`);
          }
        else {
          const [e6, t4] = a4[0];
          p3.push(`exports(${JSON.stringify(e6)},${s3}${t4});`);
        }
      }
      c3.push(p3.join(`${a3}${n3}${n3}${n3}`));
    }
    return { importBindings: l3, setters: c3, starExcludes: u3 };
  }(n2, s2, r2, a2), w2 = h2 ? `'${h2}',${g2}` : "", v2 = t2.has("module") ? ["exports", "module"] : i2 ? ["exports"] : [];
  let P2 = `System.register(${w2}[` + n2.map(({ importPath: e5 }) => `'${e5}'`).join(`,${g2}`) + `],${g2}(${b2(v2, { isAsync: false, name: null })}{${E2}${r2}${f2 ? "'use strict';" : ""}` + Al(S2, r2, a2) + Sl($2, r2, a2) + `${E2}${r2}return${g2}{${A2.length > 0 ? `${E2}${r2}${r2}setters:${g2}[${A2.map((e5) => e5 ? `${y2(["module"], { isAsync: false, name: null })}{${E2}${r2}${r2}${r2}${e5}${E2}${r2}${r2}}` : m2 ? "null" : `${y2([], { isAsync: false, name: null })}{}`).join(`,${g2}`)}],` : ""}${E2}`;
  P2 += `${r2}${r2}execute:${g2}(${b2([], { isAsync: c2, name: null })}{${E2}${E2}`;
  const I2 = `${r2}${r2}})${E2}${r2}}${x2}${E2}}));`;
  e4.prepend(o2 + ao(null, t2, r2, a2, u2, d2, p2) + wl(s2, r2, a2)).append(`${l2}${E2}${E2}` + Pl(s2, r2, a2) + Il(s2, r2, a2)).indent(`${r2}${r2}${r2}`).append(I2).prepend(P2);
}, umd: function(e4, { accessedGlobals: t2, dependencies: n2, exports: s2, hasDefaultExport: i2, hasExports: r2, id: o2, indent: a2, intro: l2, namedExportsMode: c2, log: u2, outro: d2, snippets: h2 }, { amd: p2, compact: f2, esModule: m2, extend: g2, externalLiveBindings: y2, freeze: b2, interop: E2, name: x2, generatedCode: { symbols: $2 }, globals: A2, noConflict: S2, reexportProtoFromExternal: w2, strict: v2 }) {
  const { _: P2, cnst: I2, getFunctionIntro: k2, getNonArrowFunctionIntro: N2, getPropertyAccess: C2, n: O2, s: D2 } = h2, M2 = f2 ? "f" : "factory", R2 = f2 ? "g" : "global";
  if (r2 && !x2)
    return lt({ code: Rt, message: 'You must supply "output.name" for UMD bundles that have exports so that the exports are accessible in environments without a module loader.', url: Ke(ot) });
  yl(u2, n2);
  const _2 = n2.map((e5) => `'${ml(e5.importPath, p2.forceJsExtensionForImports)}'`), L2 = n2.map((e5) => `require('${e5.importPath}')`), B2 = xl(n2), T2 = B2.map((e5) => kl(e5.globalName, R2, C2)), z2 = B2.map((e5) => e5.name);
  c2 && (r2 || S2) && (_2.unshift("'exports'"), L2.unshift("exports"), T2.unshift(El(x2, R2, A2, (g2 ? `${kl(x2, R2, C2)}${P2}||${P2}` : "") + "{}", h2)), z2.unshift("exports"));
  const V2 = ll(p2, o2), F2 = (V2 ? `'${V2}',${P2}` : "") + (_2.length > 0 ? `[${_2.join(`,${P2}`)}],${P2}` : ""), j2 = p2.define, U2 = !c2 && r2 ? `module.exports${P2}=${P2}` : "", G2 = v2 ? `${P2}'use strict';${O2}` : "";
  let W2;
  if (S2) {
    const e5 = f2 ? "e" : "exports";
    let t3;
    if (!c2 && r2)
      t3 = `${I2} ${e5}${P2}=${P2}${El(x2, R2, A2, `${M2}(${T2.join(`,${P2}`)})`, h2)};`;
    else {
      t3 = `${I2} ${e5}${P2}=${P2}${T2.shift()};${O2}${a2}${a2}${M2}(${[e5, ...T2].join(`,${P2}`)});`;
    }
    W2 = `(${k2([], { isAsync: false, name: null })}{${O2}${a2}${a2}${I2} current${P2}=${P2}${function(e6, t4, { _: n3, getPropertyAccess: s3 }) {
      let i3 = t4;
      return e6.split(".").map((e7) => i3 += s3(e7)).join(`${n3}&&${n3}`);
    }(x2, R2, h2)};${O2}${a2}${a2}${t3}${O2}${a2}${a2}${e5}.noConflict${P2}=${P2}${k2([], { isAsync: false, name: null })}{${P2}${kl(x2, R2, C2)}${P2}=${P2}current;${P2}return ${e5}${D2}${P2}};${O2}${a2}})()`;
  } else
    W2 = `${M2}(${T2.join(`,${P2}`)})`, !c2 && r2 && (W2 = El(x2, R2, A2, W2, h2));
  const q2 = r2 || S2 && c2 || T2.length > 0, H2 = [M2];
  q2 && H2.unshift(R2);
  const K2 = q2 ? `this,${P2}` : "", Y2 = q2 ? `(${R2}${P2}=${P2}typeof globalThis${P2}!==${P2}'undefined'${P2}?${P2}globalThis${P2}:${P2}${R2}${P2}||${P2}self,${P2}` : "", J2 = q2 ? ")" : "", X2 = q2 ? `${a2}typeof exports${P2}===${P2}'object'${P2}&&${P2}typeof module${P2}!==${P2}'undefined'${P2}?${P2}${U2}${M2}(${L2.join(`,${P2}`)})${P2}:${O2}` : "", Z2 = `(${N2(H2, { isAsync: false, name: null })}{${O2}` + X2 + `${a2}typeof ${j2}${P2}===${P2}'function'${P2}&&${P2}${j2}.amd${P2}?${P2}${j2}(${F2}${M2})${P2}:${O2}${a2}${Y2}${W2}${J2};${O2}})(${K2}(${N2(z2, { isAsync: false, name: null })}{${G2}${O2}`, Q2 = O2 + O2 + "}));";
  e4.prepend(`${l2}${fl(n2, E2, y2, b2, $2, t2, a2, h2)}`);
  const ee2 = cl(s2, n2, c2, E2, h2, a2, y2, w2);
  let te2 = hl(c2 && r2, true === m2 || "if-default-prop" === m2 && i2, $2, h2);
  te2 && (te2 = O2 + O2 + te2), e4.append(`${ee2}${te2}${d2}`).trim().indent(a2).append(Q2).prepend(Z2);
} };
const Cl = (e4, t2) => t2 ? `${e4}
${t2}` : e4, Ol = (e4, t2) => t2 ? `${e4}

${t2}` : e4;
async function Dl(e4, t2, n2) {
  try {
    let [s3, i3, r3, o2] = await Promise.all([t2.hookReduceValue("banner", e4.banner(n2), [n2], Cl), t2.hookReduceValue("footer", e4.footer(n2), [n2], Cl), t2.hookReduceValue("intro", e4.intro(n2), [n2], Ol), t2.hookReduceValue("outro", e4.outro(n2), [n2], Ol)]);
    return r3 && (r3 += "\n\n"), o2 && (o2 = `

${o2}`), s3 && (s3 += "\n"), i3 && (i3 = "\n" + i3), { banner: s3, footer: i3, intro: r3, outro: o2 };
  } catch (e5) {
    return lt((s2 = e5.message, i2 = e5.hook, r2 = e5.plugin, { code: pt, message: `Could not retrieve "${i2}". Check configuration of plugin "${r2}".
	Error Message: ${s2}` }));
  }
  var s2, i2, r2;
}
const Ml = { amd: Ll, cjs: Ll, es: _l, iife: Ll, system: _l, umd: Ll };
function Rl(e4, t2, n2, s2, i2, r2, o2, a2, l2, c2, u2, d2, h2, p2) {
  const f2 = [...e4].reverse();
  for (const e5 of f2)
    e5.scope.addUsedOutsideNames(s2, i2, d2, h2);
  !function(e5, t3, n3) {
    for (const s3 of t3) {
      for (const t4 of s3.scope.variables.values())
        t4.included && !(t4.renderBaseName || t4 instanceof ha && t4.getOriginalVariable() !== t4) && t4.setRenderNames(null, Pi(t4.name, e5, t4.forbiddenNames));
      if (n3.has(s3)) {
        const t4 = s3.namespace;
        t4.setRenderNames(null, Pi(t4.name, e5, t4.forbiddenNames));
      }
    }
  }(s2, f2, p2), Ml[i2](s2, n2, t2, r2, o2, a2, l2, c2, u2);
  for (const e5 of f2)
    e5.scope.deconflict(i2, d2, h2);
}
function _l(e4, t2, n2, s2, i2, r2, o2, a2, l2) {
  for (const t3 of n2.dependencies)
    (i2 || t3 instanceof F) && (t3.variableName = Pi(t3.suggestedVariableName, e4, null));
  for (const n3 of t2) {
    const t3 = n3.module, s3 = n3.name;
    n3.isNamespace && (i2 || t3 instanceof En) ? n3.setRenderNames(null, (t3 instanceof En ? a2.get(t3) : o2.get(t3)).variableName) : t3 instanceof En && "default" === s3 ? n3.setRenderNames(null, Pi([...t3.exportedVariables].some(([e5, t4]) => "*" === t4 && e5.included) ? t3.suggestedVariableName + "__default" : t3.suggestedVariableName, e4, n3.forbiddenNames)) : n3.setRenderNames(null, Pi(Ce(s3), e4, n3.forbiddenNames));
  }
  for (const t3 of l2)
    t3.setRenderNames(null, Pi(t3.name, e4, t3.forbiddenNames));
}
function Ll(e4, t2, { deconflictedDefault: n2, deconflictedNamespace: s2, dependencies: i2 }, r2, o2, a2, l2, c2) {
  for (const t3 of i2)
    t3.variableName = Pi(t3.suggestedVariableName, e4, null);
  for (const t3 of s2)
    t3.namespaceVariableName = Pi(`${t3.suggestedVariableName}__namespace`, e4, null);
  for (const t3 of n2)
    t3.defaultVariableName = s2.has(t3) && oo(r2(t3.id), a2) ? t3.namespaceVariableName : Pi(`${t3.suggestedVariableName}__default`, e4, null);
  for (const e5 of t2) {
    const t3 = e5.module;
    if (t3 instanceof En) {
      const n3 = c2.get(t3), s3 = e5.name;
      if ("default" === s3) {
        const s4 = r2(t3.id), i3 = so[s4] ? n3.defaultVariableName : n3.variableName;
        io(s4, a2) ? e5.setRenderNames(i3, "default") : e5.setRenderNames(null, i3);
      } else
        "*" === s3 ? e5.setRenderNames(null, ro[r2(t3.id)] ? n3.namespaceVariableName : n3.variableName) : e5.setRenderNames(n3.variableName, null);
    } else {
      const n3 = l2.get(t3);
      o2 && e5.isNamespace ? e5.setRenderNames(null, "default" === n3.exportMode ? n3.namespaceVariableName : n3.variableName) : "default" === n3.exportMode ? e5.setRenderNames(null, n3.variableName) : e5.setRenderNames(n3.variableName, n3.getVariableExportName(e5));
    }
  }
}
function Bl(e4, { exports: t2, name: n2, format: s2 }, i2, r2) {
  const o2 = e4.getExportNames();
  if ("default" === t2) {
    if (1 !== o2.length || "default" !== o2[0])
      return lt(sn("default", o2, i2));
  } else if ("none" === t2 && o2.length > 0)
    return lt(sn("none", o2, i2));
  return "auto" === t2 && (0 === o2.length ? t2 = "none" : 1 === o2.length && "default" === o2[0] ? t2 = "default" : ("es" !== s2 && "system" !== s2 && o2.includes("default") && r2(Le, function(e5, t3) {
    return { code: Bt, id: e5, message: `Entry module "${B(e5)}" is using named and default exports together. Consumers of your bundle will have to use \`${t3 || "chunk"}.default\` to access the default export, which may not be what you want. Use \`output.exports: "named"\` to disable this warning.`, url: Ke(Qe) };
  }(i2, n2)), t2 = "named")), t2;
}
function Tl(e4) {
  const t2 = e4.split("\n"), n2 = t2.filter((e5) => /^\t+/.test(e5)), s2 = t2.filter((e5) => /^ {2,}/.test(e5));
  if (0 === n2.length && 0 === s2.length)
    return null;
  if (n2.length >= s2.length)
    return "	";
  const i2 = s2.reduce((e5, t3) => {
    const n3 = /^ +/.exec(t3)[0].length;
    return Math.min(n3, e5);
  }, 1 / 0);
  return " ".repeat(i2);
}
function zl(e4, t2, n2, s2, i2, r2) {
  const o2 = e4.getDependenciesToBeIncluded();
  for (const e5 of o2) {
    if (e5 instanceof En) {
      t2.push(r2.get(e5));
      continue;
    }
    const o3 = i2.get(e5);
    o3 === s2 ? n2.has(e5) || (n2.add(e5), zl(e5, t2, n2, s2, i2, r2)) : t2.push(o3);
  }
}
const Vl = "!~{", Fl = "}~", jl = new RegExp(`${Vl}[0-9a-zA-Z_$]{1,17}${Fl}`, "g"), Ul = (e4, t2) => e4.replace(jl, (e5) => t2.get(e5) || e5), Gl = (e4, t2, n2) => e4.replace(jl, (e5) => e5 === t2 ? n2 : e5), Wl = (e4, t2) => {
  const n2 = /* @__PURE__ */ new Set(), s2 = e4.replace(jl, (e5) => t2.has(e5) ? (n2.add(e5), `${Vl}${"0".repeat(e5.length - 5)}${Fl}`) : e5);
  return { containedPlaceholders: n2, transformedCode: s2 };
}, ql = Symbol("bundleKeys"), Hl = { type: "placeholder" };
function Kl(e4, t2, n2) {
  return T(e4) ? lt(yn(`Invalid pattern "${e4}" for "${t2}", patterns can be neither absolute nor relative paths. If you want your files to be stored in a subdirectory, write its name without a leading slash like this: subdirectory/pattern.`)) : e4.replace(/\[(\w+)(:\d+)?]/g, (e5, s2, i2) => {
    if (!n2.hasOwnProperty(s2) || i2 && "hash" !== s2)
      return lt(yn(`"[${s2}${i2 || ""}]" is not a valid placeholder in the "${t2}" pattern.`));
    const r2 = n2[s2](i2 && Number.parseInt(i2.slice(1)));
    return T(r2) ? lt(yn(`Invalid substitution "${r2}" for placeholder "[${s2}]" in "${t2}" pattern, can be neither absolute nor relative path.`)) : r2;
  });
}
function Yl(e4, { [ql]: t2 }) {
  if (!t2.has(e4.toLowerCase()))
    return e4;
  const n2 = N(e4);
  e4 = e4.slice(0, Math.max(0, e4.length - n2.length));
  let s2, i2 = 1;
  for (; t2.has((s2 = e4 + ++i2 + n2).toLowerCase()); )
    ;
  return s2;
}
const Jl = /* @__PURE__ */ new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".mts", ".cjs", ".cts"]);
function Xl(e4, t2, n2, s2) {
  const i2 = "function" == typeof t2 ? t2(e4.id) : t2[e4.id];
  return i2 || (n2 ? (s2(Le, (r2 = e4.id, o2 = e4.variableName, { code: Dt, id: r2, message: `No name was provided for external module "${r2}" in "output.globals" – guessing "${o2}".`, names: [o2], url: Ke(nt) })), e4.variableName) : void 0);
  var r2, o2;
}
class Zl {
  constructor(e4, t2, n2, s2, i2, r2, o2, a2, l2, c2, u2, d2, h2, p2, f2) {
    this.orderedModules = e4, this.inputOptions = t2, this.outputOptions = n2, this.unsetOptions = s2, this.pluginDriver = i2, this.modulesById = r2, this.chunkByModule = o2, this.externalChunkByModule = a2, this.facadeChunkByModule = l2, this.includedNamespaces = c2, this.manualChunkAlias = u2, this.getPlaceholder = d2, this.bundle = h2, this.inputBase = p2, this.snippets = f2, this.entryModules = [], this.exportMode = "named", this.facadeModule = null, this.namespaceVariableName = "", this.variableName = "", this.accessedGlobalsByScope = /* @__PURE__ */ new Map(), this.dependencies = /* @__PURE__ */ new Set(), this.dynamicEntryModules = [], this.dynamicName = null, this.exportNamesByVariable = /* @__PURE__ */ new Map(), this.exports = /* @__PURE__ */ new Set(), this.exportsByName = /* @__PURE__ */ new Map(), this.fileName = null, this.implicitEntryModules = [], this.implicitlyLoadedBefore = /* @__PURE__ */ new Set(), this.imports = /* @__PURE__ */ new Set(), this.includedDynamicImports = null, this.includedReexportsByModule = /* @__PURE__ */ new Map(), this.isEmpty = true, this.name = null, this.needsExportsShim = false, this.preRenderedChunkInfo = null, this.preliminaryFileName = null, this.preliminarySourcemapFileName = null, this.renderedChunkInfo = null, this.renderedDependencies = null, this.renderedModules = /* @__PURE__ */ Object.create(null), this.sortedExportNames = null, this.strictFacade = false, this.execIndex = e4.length > 0 ? e4[0].execIndex : 1 / 0;
    const m2 = new Set(e4);
    for (const t3 of e4) {
      o2.set(t3, this), t3.namespace.included && !n2.preserveModules && c2.add(t3), this.isEmpty && t3.isIncluded() && (this.isEmpty = false), (t3.info.isEntry || n2.preserveModules) && this.entryModules.push(t3);
      for (const e5 of t3.includedDynamicImporters)
        m2.has(e5) || (this.dynamicEntryModules.push(t3), t3.info.syntheticNamedExports && (c2.add(t3), this.exports.add(t3.namespace)));
      t3.implicitlyLoadedAfter.size > 0 && this.implicitEntryModules.push(t3);
    }
    this.suggestedVariableName = Ce(this.generateVariableName());
  }
  static generateFacade(e4, t2, n2, s2, i2, r2, o2, a2, l2, c2, u2, d2, h2, p2, f2) {
    const m2 = new Zl([], e4, t2, n2, s2, i2, r2, o2, a2, l2, null, d2, h2, p2, f2);
    m2.assignFacadeName(u2, c2), a2.has(c2) || a2.set(c2, m2);
    for (const e5 of c2.getDependenciesToBeIncluded())
      m2.dependencies.add(e5 instanceof il ? r2.get(e5) : o2.get(e5));
    return !m2.dependencies.has(r2.get(c2)) && c2.info.moduleSideEffects && c2.hasEffects() && m2.dependencies.add(r2.get(c2)), m2.ensureReexportsAreAvailableForModule(c2), m2.facadeModule = c2, m2.strictFacade = true, m2;
  }
  canModuleBeFacade(e4, t2) {
    const n2 = e4.getExportNamesByVariable();
    for (const e5 of this.exports)
      if (!n2.has(e5))
        return false;
    for (const s2 of t2)
      if (!(s2.module === e4 || n2.has(s2) || s2 instanceof Da && n2.has(s2.getBaseVariable())))
        return false;
    return true;
  }
  finalizeChunk(e4, t2, n2, s2) {
    const i2 = this.getRenderedChunkInfo(), r2 = (e5) => Ul(e5, s2), o2 = i2.fileName, a2 = this.fileName = r2(o2);
    return { ...i2, code: e4, dynamicImports: i2.dynamicImports.map(r2), fileName: a2, implicitlyLoadedBefore: i2.implicitlyLoadedBefore.map(r2), importedBindings: Object.fromEntries(Object.entries(i2.importedBindings).map(([e5, t3]) => [r2(e5), t3])), imports: i2.imports.map(r2), map: t2, preliminaryFileName: o2, referencedFiles: i2.referencedFiles.map(r2), sourcemapFileName: n2 };
  }
  generateExports() {
    this.sortedExportNames = null;
    const e4 = new Set(this.exports);
    if (null !== this.facadeModule && (false !== this.facadeModule.preserveSignature || this.strictFacade)) {
      const t2 = this.facadeModule.getExportNamesByVariable();
      for (const [n2, s2] of t2) {
        this.exportNamesByVariable.set(n2, [...s2]);
        for (const e5 of s2)
          this.exportsByName.set(e5, n2);
        e4.delete(n2);
      }
    }
    this.outputOptions.minifyInternalExports ? function(e5, t2, n2) {
      let s2 = 0;
      for (const i2 of e5) {
        let [e6] = i2.name;
        if (t2.has(e6))
          do {
            e6 = vi(++s2), 49 === e6.charCodeAt(0) && (s2 += 9 * 64 ** (e6.length - 1), e6 = vi(s2));
          } while (Ie.has(e6) || t2.has(e6));
        t2.set(e6, i2), n2.set(i2, [e6]);
      }
    }(e4, this.exportsByName, this.exportNamesByVariable) : function(e5, t2, n2) {
      for (const s2 of e5) {
        let e6 = 0, i2 = s2.name;
        for (; t2.has(i2); )
          i2 = s2.name + "$" + ++e6;
        t2.set(i2, s2), n2.set(s2, [i2]);
      }
    }(e4, this.exportsByName, this.exportNamesByVariable), (this.outputOptions.preserveModules || this.facadeModule && this.facadeModule.info.isEntry) && (this.exportMode = Bl(this, this.outputOptions, this.facadeModule.id, this.inputOptions.onLog));
  }
  generateFacades() {
    var _a3;
    const e4 = [], t2 = /* @__PURE__ */ new Set([...this.entryModules, ...this.implicitEntryModules]), n2 = new Set(this.dynamicEntryModules.map(({ namespace: e5 }) => e5));
    for (const e5 of t2)
      if (e5.preserveSignature)
        for (const t3 of e5.getExportNamesByVariable().keys())
          this.chunkByModule.get(t3.module) === this && n2.add(t3);
    for (const s2 of t2) {
      const t3 = Array.from(new Set(s2.chunkNames.filter(({ isUserDefined: e5 }) => e5).map(({ name: e5 }) => e5)), (e5) => ({ name: e5 }));
      if (0 === t3.length && s2.isUserDefinedEntryPoint && t3.push({}), t3.push(...Array.from(s2.chunkFileNames, (e5) => ({ fileName: e5 }))), 0 === t3.length && t3.push({}), !this.facadeModule) {
        const e5 = !this.outputOptions.preserveModules && ("strict" === s2.preserveSignature || "exports-only" === s2.preserveSignature && s2.getExportNamesByVariable().size > 0);
        e5 && !this.canModuleBeFacade(s2, n2) || (this.facadeModule = s2, this.facadeChunkByModule.set(s2, this), s2.preserveSignature && (this.strictFacade = e5), this.assignFacadeName(t3.shift(), s2, this.outputOptions.preserveModules));
      }
      for (const n3 of t3)
        e4.push(Zl.generateFacade(this.inputOptions, this.outputOptions, this.unsetOptions, this.pluginDriver, this.modulesById, this.chunkByModule, this.externalChunkByModule, this.facadeChunkByModule, this.includedNamespaces, s2, n3, this.getPlaceholder, this.bundle, this.inputBase, this.snippets));
    }
    for (const e5 of this.dynamicEntryModules)
      e5.info.syntheticNamedExports || (!this.facadeModule && this.canModuleBeFacade(e5, n2) ? (this.facadeModule = e5, this.facadeChunkByModule.set(e5, this), this.strictFacade = true, this.dynamicName = Ql(e5)) : this.facadeModule === e5 && !this.strictFacade && this.canModuleBeFacade(e5, n2) ? this.strictFacade = true : ((_a3 = this.facadeChunkByModule.get(e5)) == null ? void 0 : _a3.strictFacade) || (this.includedNamespaces.add(e5), this.exports.add(e5.namespace)));
    return this.outputOptions.preserveModules || this.addNecessaryImportsForFacades(), e4;
  }
  getChunkName() {
    return this.name ?? (this.name = this.outputOptions.sanitizeFileName(this.getFallbackChunkName()));
  }
  getExportNames() {
    return this.sortedExportNames ?? (this.sortedExportNames = [...this.exportsByName.keys()].sort());
  }
  getFileName() {
    return this.fileName || this.getPreliminaryFileName().fileName;
  }
  getImportPath(e4) {
    return _(V(e4, this.getFileName(), "amd" === this.outputOptions.format && !this.outputOptions.amd.forceJsExtensionForImports, true));
  }
  getPreliminaryFileName() {
    var _a3;
    if (this.preliminaryFileName)
      return this.preliminaryFileName;
    let e4, t2 = null;
    const { chunkFileNames: n2, entryFileNames: s2, file: i2, format: r2, preserveModules: o2 } = this.outputOptions;
    if (i2)
      e4 = I(i2);
    else if (null === this.fileName) {
      const [i3, a2] = o2 || ((_a3 = this.facadeModule) == null ? void 0 : _a3.isUserDefinedEntryPoint) ? [s2, "output.entryFileNames"] : [n2, "output.chunkFileNames"];
      e4 = Kl("function" == typeof i3 ? i3(this.getPreRenderedChunkInfo()) : i3, a2, { format: () => r2, hash: (e5) => t2 || (t2 = this.getPlaceholder(a2, e5 || 8)), name: () => this.getChunkName() }), t2 || (e4 = Yl(e4, this.bundle));
    } else
      e4 = this.fileName;
    return t2 || (this.bundle[e4] = Hl), this.preliminaryFileName = { fileName: e4, hashPlaceholder: t2 };
  }
  getPreliminarySourcemapFileName() {
    if (this.preliminarySourcemapFileName)
      return this.preliminarySourcemapFileName;
    let e4 = null, t2 = null;
    const { sourcemapFileNames: n2, format: s2 } = this.outputOptions;
    if (!n2)
      return null;
    {
      const [i2, r2] = [n2, "output.sourcemapFileNames"];
      e4 = Kl("function" == typeof i2 ? i2(this.getPreRenderedChunkInfo()) : i2, r2, { chunkhash: () => this.getPreliminaryFileName().hashPlaceholder || "", format: () => s2, hash: (e5) => t2 || (t2 = this.getPlaceholder(r2, e5 || 8)), name: () => this.getChunkName() }), t2 || (e4 = Yl(e4, this.bundle));
    }
    return this.preliminarySourcemapFileName = { fileName: e4, hashPlaceholder: t2 };
  }
  getRenderedChunkInfo() {
    return this.renderedChunkInfo ? this.renderedChunkInfo : this.renderedChunkInfo = { ...this.getPreRenderedChunkInfo(), dynamicImports: this.getDynamicDependencies().map(sc), fileName: this.getFileName(), implicitlyLoadedBefore: Array.from(this.implicitlyLoadedBefore, sc), importedBindings: tc(this.getRenderedDependencies(), sc), imports: Array.from(this.dependencies, sc), modules: this.renderedModules, referencedFiles: this.getReferencedFiles() };
  }
  getVariableExportName(e4) {
    return this.outputOptions.preserveModules && e4 instanceof Oa ? "*" : this.exportNamesByVariable.get(e4)[0];
  }
  link() {
    this.dependencies = function(e4, t2, n2, s2) {
      const i2 = [], r2 = /* @__PURE__ */ new Set();
      for (let o3 = t2.length - 1; o3 >= 0; o3--) {
        const a2 = t2[o3];
        if (!r2.has(a2)) {
          const t3 = [];
          zl(a2, t3, r2, e4, n2, s2), i2.unshift(t3);
        }
      }
      const o2 = /* @__PURE__ */ new Set();
      for (const e5 of i2)
        for (const t3 of e5)
          o2.add(t3);
      return o2;
    }(this, this.orderedModules, this.chunkByModule, this.externalChunkByModule);
    for (const e4 of this.orderedModules)
      this.addImplicitlyLoadedBeforeFromModule(e4), this.setUpChunkImportsAndExportsForModule(e4);
  }
  async render() {
    const { dependencies: e4, exportMode: t2, facadeModule: n2, inputOptions: { onLog: s2 }, outputOptions: i2, pluginDriver: r2, snippets: o2 } = this, { format: a2, hoistTransitiveImports: l2, preserveModules: c2 } = i2;
    if (l2 && !c2 && null !== n2)
      for (const t3 of e4)
        t3 instanceof Zl && this.inlineChunkDependencies(t3);
    const u2 = this.getPreliminaryFileName(), d2 = this.getPreliminarySourcemapFileName(), { accessedGlobals: h2, indent: p2, magicString: f2, renderedSource: m2, usedModules: g2, usesTopLevelAwait: y2 } = this.renderModules(u2.fileName), b2 = [...this.getRenderedDependencies().values()], E2 = "none" === t2 ? [] : this.getChunkExportDeclarations(a2);
    let x2 = E2.length > 0, $2 = false;
    for (const e5 of b2) {
      const { reexports: t3 } = e5;
      (t3 == null ? void 0 : t3.length) && (x2 = true, !$2 && t3.some((e6) => "default" === e6.reexported) && ($2 = true), "es" === a2 && (e5.reexports = t3.filter(({ reexported: e6 }) => !E2.find(({ exported: t4 }) => t4 === e6))));
    }
    if (!$2) {
      for (const { exported: e5 } of E2)
        if ("default" === e5) {
          $2 = true;
          break;
        }
    }
    const { intro: A2, outro: S2, banner: w2, footer: v2 } = await Dl(i2, r2, this.getRenderedChunkInfo());
    if (Nl[a2](m2, { accessedGlobals: h2, dependencies: b2, exports: E2, hasDefaultExport: $2, hasExports: x2, id: u2.fileName, indent: p2, intro: A2, isEntryFacade: c2 || null !== n2 && n2.info.isEntry, isModuleFacade: null !== n2, log: s2, namedExportsMode: "default" !== t2, outro: S2, snippets: o2, usesTopLevelAwait: y2 }, i2), w2 && f2.prepend(w2), "es" === a2 || "cjs" === a2) {
      const e5 = null !== n2 && n2.info.isEntry && n2.shebang;
      e5 && f2.prepend(`#!${e5}
`);
    }
    return v2 && f2.append(v2), { chunk: this, magicString: f2, preliminaryFileName: u2, preliminarySourcemapFileName: d2, usedModules: g2 };
  }
  addImplicitlyLoadedBeforeFromModule(e4) {
    const { chunkByModule: t2, implicitlyLoadedBefore: n2 } = this;
    for (const s2 of e4.implicitlyLoadedBefore) {
      const e5 = t2.get(s2);
      e5 && e5 !== this && n2.add(e5);
    }
  }
  addNecessaryImportsForFacades() {
    for (const [e4, t2] of this.includedReexportsByModule)
      if (this.includedNamespaces.has(e4))
        for (const e5 of t2)
          this.imports.add(e5);
  }
  assignFacadeName({ fileName: e4, name: t2 }, n2, s2) {
    e4 ? this.fileName = e4 : this.name = this.outputOptions.sanitizeFileName(t2 || (s2 ? this.getPreserveModulesChunkNameFromModule(n2) : Ql(n2)));
  }
  checkCircularDependencyImport(e4, t2) {
    var _a3;
    const n2 = e4.module;
    if (n2 instanceof il) {
      const l2 = this.chunkByModule.get(n2);
      let c2;
      do {
        if (c2 = t2.alternativeReexportModules.get(e4), c2) {
          this.chunkByModule.get(c2) !== l2 && this.inputOptions.onLog(Le, (s2 = ((_a3 = n2.getExportNamesByVariable().get(e4)) == null ? void 0 : _a3[0]) || "*", i2 = n2.id, r2 = c2.id, o2 = t2.id, a2 = this.outputOptions.preserveModules, { code: "CYCLIC_CROSS_CHUNK_REEXPORT", exporter: i2, id: o2, message: `Export "${s2}" of module "${B(i2)}" was reexported through module "${B(r2)}" while both modules are dependencies of each other and will end up in different chunks by current Rollup settings. This scenario is not well supported at the moment as it will produce a circular dependency between chunks and will likely lead to broken execution order.
Either change the import in "${B(o2)}" to point directly to the exporting module or ${a2 ? 'do not use "output.preserveModules"' : 'reconfigure "output.manualChunks"'} to ensure these modules end up in the same chunk.`, reexporter: r2 })), t2 = c2;
        }
      } while (c2);
    }
    var s2, i2, r2, o2, a2;
  }
  ensureReexportsAreAvailableForModule(e4) {
    const t2 = [], n2 = e4.getExportNamesByVariable();
    for (const s2 of n2.keys()) {
      const n3 = s2 instanceof Da, i2 = n3 ? s2.getBaseVariable() : s2;
      if (this.checkCircularDependencyImport(i2, e4), !(i2 instanceof Oa && this.outputOptions.preserveModules)) {
        const e5 = i2.module;
        if (e5 instanceof il) {
          const s3 = this.chunkByModule.get(e5);
          s3 && s3 !== this && (s3.exports.add(i2), t2.push(i2), n3 && this.imports.add(i2));
        }
      }
    }
    t2.length > 0 && this.includedReexportsByModule.set(e4, t2);
  }
  generateVariableName() {
    if (this.manualChunkAlias)
      return this.manualChunkAlias;
    const e4 = this.entryModules[0] || this.implicitEntryModules[0] || this.dynamicEntryModules[0] || this.orderedModules[this.orderedModules.length - 1];
    return e4 ? Ql(e4) : "chunk";
  }
  getChunkExportDeclarations(e4) {
    const t2 = [];
    for (const n2 of this.getExportNames()) {
      if ("*" === n2[0])
        continue;
      const s2 = this.exportsByName.get(n2);
      if (!(s2 instanceof Da)) {
        const t3 = s2.module;
        if (t3) {
          const s3 = this.chunkByModule.get(t3);
          if (s3 !== this) {
            if (!s3 || "es" !== e4)
              continue;
            const t4 = this.renderedDependencies.get(s3);
            if (!t4)
              continue;
            const { imports: i3, reexports: r3 } = t4, o3 = r3 == null ? void 0 : r3.find(({ reexported: e5 }) => e5 === n2), a2 = i3 == null ? void 0 : i3.find(({ imported: e5 }) => e5 === (o3 == null ? void 0 : o3.imported));
            if (!a2)
              continue;
          }
        }
      }
      let i2 = null, r2 = false, o2 = s2.getName(this.snippets.getPropertyAccess);
      if (s2 instanceof fi) {
        for (const e5 of s2.declarations)
          if (e5.parent instanceof _r || e5 instanceof Lr && e5.declaration instanceof _r) {
            r2 = true;
            break;
          }
      } else
        s2 instanceof Da && (i2 = o2, "es" === e4 && (o2 = s2.renderName));
      t2.push({ exported: n2, expression: i2, hoisted: r2, local: o2 });
    }
    return t2;
  }
  getDependenciesToBeDeconflicted(e4, t2, n2) {
    var _a3;
    const s2 = /* @__PURE__ */ new Set(), i2 = /* @__PURE__ */ new Set(), r2 = /* @__PURE__ */ new Set();
    for (const t3 of [...this.exportNamesByVariable.keys(), ...this.imports])
      if (e4 || t3.isNamespace) {
        const o2 = t3.module;
        if (o2 instanceof En) {
          const a2 = this.externalChunkByModule.get(o2);
          s2.add(a2), e4 && ("default" === t3.name ? so[n2(o2.id)] && i2.add(a2) : t3.isNamespace && ro[n2(o2.id)] && (this.imports.has(t3) || !((_a3 = this.exportNamesByVariable.get(t3)) == null ? void 0 : _a3.every((e5) => e5.startsWith("*")))) && r2.add(a2));
        } else {
          const n3 = this.chunkByModule.get(o2);
          n3 !== this && (s2.add(n3), e4 && "default" === n3.exportMode && t3.isNamespace && r2.add(n3));
        }
      }
    if (t2)
      for (const e5 of this.dependencies)
        s2.add(e5);
    return { deconflictedDefault: i2, deconflictedNamespace: r2, dependencies: s2 };
  }
  getDynamicDependencies() {
    return this.getIncludedDynamicImports().map((e4) => e4.facadeChunk || e4.chunk || e4.externalChunk || e4.resolution).filter((e4) => e4 !== this && (e4 instanceof Zl || e4 instanceof F));
  }
  getDynamicImportStringAndAttributes(e4, t2) {
    if (e4 instanceof En) {
      const n2 = this.externalChunkByModule.get(e4);
      return [`'${n2.getImportPath(t2)}'`, n2.getImportAttributes(this.snippets)];
    }
    return [e4 || "", "es" === this.outputOptions.format && this.outputOptions.externalImportAttributes || null];
  }
  getFallbackChunkName() {
    return this.manualChunkAlias ? this.manualChunkAlias : this.dynamicName ? this.dynamicName : this.fileName ? L(this.fileName) : L(this.orderedModules[this.orderedModules.length - 1].id);
  }
  getImportSpecifiers() {
    const { interop: e4 } = this.outputOptions, t2 = /* @__PURE__ */ new Map();
    for (const n2 of this.imports) {
      const s2 = n2.module;
      let i2, r2;
      if (s2 instanceof En) {
        if (i2 = this.externalChunkByModule.get(s2), r2 = n2.name, "default" !== r2 && "*" !== r2 && "defaultOnly" === e4(s2.id))
          return lt(mn(s2.id, r2, false));
      } else
        i2 = this.chunkByModule.get(s2), r2 = i2.getVariableExportName(n2);
      j(t2, i2, G).push({ imported: r2, local: n2.getName(this.snippets.getPropertyAccess) });
    }
    return t2;
  }
  getIncludedDynamicImports() {
    if (this.includedDynamicImports)
      return this.includedDynamicImports;
    const e4 = [];
    for (const t2 of this.orderedModules)
      for (const { node: n2, resolution: s2 } of t2.dynamicImports)
        n2.included && e4.push(s2 instanceof il ? { chunk: this.chunkByModule.get(s2), externalChunk: null, facadeChunk: this.facadeChunkByModule.get(s2), node: n2, resolution: s2 } : s2 instanceof En ? { chunk: null, externalChunk: this.externalChunkByModule.get(s2), facadeChunk: null, node: n2, resolution: s2 } : { chunk: null, externalChunk: null, facadeChunk: null, node: n2, resolution: s2 });
    return this.includedDynamicImports = e4;
  }
  getPreRenderedChunkInfo() {
    if (this.preRenderedChunkInfo)
      return this.preRenderedChunkInfo;
    const { dynamicEntryModules: e4, facadeModule: t2, implicitEntryModules: n2, orderedModules: s2 } = this;
    return this.preRenderedChunkInfo = { exports: this.getExportNames(), facadeModuleId: t2 && t2.id, isDynamicEntry: e4.length > 0, isEntry: !!(t2 == null ? void 0 : t2.info.isEntry), isImplicitEntry: n2.length > 0, moduleIds: s2.map(({ id: e5 }) => e5), name: this.getChunkName(), type: "chunk" };
  }
  getPreserveModulesChunkNameFromModule(e4) {
    const t2 = ec(e4);
    if (t2)
      return t2;
    const { preserveModulesRoot: n2, sanitizeFileName: s2 } = this.outputOptions, i2 = s2(P(e4.id.split(nc, 1)[0])), r2 = N(i2), o2 = Jl.has(r2) ? i2.slice(0, -r2.length) : i2;
    return w(o2) ? n2 && O(o2).startsWith(n2) ? o2.slice(n2.length).replace(/^[/\\]/, "") : C(this.inputBase, o2) : `_virtual/${I(o2)}`;
  }
  getReexportSpecifiers() {
    const { externalLiveBindings: e4, interop: t2 } = this.outputOptions, n2 = /* @__PURE__ */ new Map();
    for (let s2 of this.getExportNames()) {
      let i2, r2, o2 = false;
      if ("*" === s2[0]) {
        const n3 = s2.slice(1);
        "defaultOnly" === t2(n3) && this.inputOptions.onLog(Le, gn(n3)), o2 = e4, i2 = this.externalChunkByModule.get(this.modulesById.get(n3)), r2 = s2 = "*";
      } else {
        const n3 = this.exportsByName.get(s2);
        if (n3 instanceof Da)
          continue;
        const a2 = n3.module;
        if (a2 instanceof il) {
          if (i2 = this.chunkByModule.get(a2), i2 === this)
            continue;
          r2 = i2.getVariableExportName(n3), o2 = n3.isReassigned;
        } else {
          if (i2 = this.externalChunkByModule.get(a2), r2 = n3.name, "default" !== r2 && "*" !== r2 && "defaultOnly" === t2(a2.id))
            return lt(mn(a2.id, r2, true));
          o2 = e4 && ("default" !== r2 || io(t2(a2.id), true));
        }
      }
      j(n2, i2, G).push({ imported: r2, needsLiveBinding: o2, reexported: s2 });
    }
    return n2;
  }
  getReferencedFiles() {
    const e4 = /* @__PURE__ */ new Set();
    for (const t2 of this.orderedModules)
      for (const n2 of t2.importMetas) {
        const t3 = n2.getReferencedFileName(this.pluginDriver);
        t3 && e4.add(t3);
      }
    return [...e4];
  }
  getRenderedDependencies() {
    if (this.renderedDependencies)
      return this.renderedDependencies;
    const e4 = this.getImportSpecifiers(), t2 = this.getReexportSpecifiers(), n2 = /* @__PURE__ */ new Map(), s2 = this.getFileName();
    for (const i2 of this.dependencies) {
      const r2 = e4.get(i2) || null, o2 = t2.get(i2) || null, a2 = i2 instanceof F || "default" !== i2.exportMode, l2 = i2.getImportPath(s2);
      n2.set(i2, { attributes: i2 instanceof F ? i2.getImportAttributes(this.snippets) : null, defaultVariableName: i2.defaultVariableName, globalName: i2 instanceof F && ("umd" === this.outputOptions.format || "iife" === this.outputOptions.format) && Xl(i2, this.outputOptions.globals, null !== (r2 || o2), this.inputOptions.onLog), importPath: l2, imports: r2, isChunk: i2 instanceof Zl, name: i2.variableName, namedExportsMode: a2, namespaceVariableName: i2.namespaceVariableName, reexports: o2 });
    }
    return this.renderedDependencies = n2;
  }
  inlineChunkDependencies(e4) {
    for (const t2 of e4.dependencies)
      this.dependencies.has(t2) || (this.dependencies.add(t2), t2 instanceof Zl && this.inlineChunkDependencies(t2));
  }
  renderModules(e4) {
    var _a3;
    const { accessedGlobalsByScope: t2, dependencies: n2, exportNamesByVariable: s2, includedNamespaces: i2, inputOptions: { onLog: r2 }, isEmpty: o2, orderedModules: a2, outputOptions: l2, pluginDriver: c2, renderedModules: u2, snippets: d2 } = this, { compact: h2, format: p2, freeze: f2, generatedCode: { symbols: m2 } } = l2, { _: y2, cnst: E2, n: x2 } = d2;
    this.setDynamicImportResolutions(e4), this.setImportMetaResolutions(e4), this.setIdentifierRenderResolutions();
    const $2 = new b({ separator: `${x2}${x2}` }), A2 = function(e5, t3) {
      if (true !== t3.indent)
        return t3.indent;
      for (const t4 of e5) {
        const e6 = Tl(t4.originalCode);
        if (null !== e6)
          return e6;
      }
      return "	";
    }(a2, l2), S2 = [];
    let w2 = "";
    const v2 = /* @__PURE__ */ new Set(), P2 = /* @__PURE__ */ new Map(), I2 = { accessedDocumentCurrentScript: false, exportNamesByVariable: s2, format: p2, freeze: f2, indent: A2, pluginDriver: c2, snippets: d2, symbols: m2, useOriginalName: null };
    let k2 = false;
    for (const e5 of a2) {
      let n3, s3 = 0;
      if (e5.isIncluded() || i2.has(e5)) {
        const r4 = e5.render(I2);
        !I2.accessedDocumentCurrentScript && Bo.includes(p2) && ((_a3 = this.accessedGlobalsByScope.get(e5.scope)) == null ? void 0 : _a3.delete(no)), I2.accessedDocumentCurrentScript = false, { source: n3 } = r4, k2 || (k2 = r4.usesTopLevelAwait), s3 = n3.length(), s3 && (h2 && n3.lastLine().includes("//") && n3.append("\n"), P2.set(e5, n3), $2.addSource(n3), S2.push(e5));
        const o4 = e5.namespace;
        if (i2.has(e5)) {
          const e6 = o4.renderBlock(I2);
          o4.renderFirst() ? w2 += x2 + e6 : $2.addSource(new g(e6));
        }
        const a3 = t2.get(e5.scope);
        if (a3)
          for (const e6 of a3)
            v2.add(e6);
      }
      const { renderedExports: r3, removedExports: o3 } = e5.getRenderedExports();
      u2[e5.id] = { get code() {
        return (n3 == null ? void 0 : n3.toString()) ?? null;
      }, originalLength: e5.originalCode.length, removedExports: o3, renderedExports: r3, renderedLength: s3 };
    }
    w2 && $2.prepend(w2 + x2 + x2), this.needsExportsShim && $2.prepend(`${x2}${E2} ${Na}${y2}=${y2}void 0;${x2}${x2}`);
    const N2 = h2 ? $2 : $2.trim();
    var C2;
    return o2 && 0 === this.getExportNames().length && 0 === n2.size && r2(Le, { code: "EMPTY_BUNDLE", message: `Generated an empty chunk: "${C2 = this.getChunkName()}".`, names: [C2] }), { accessedGlobals: v2, indent: A2, magicString: $2, renderedSource: N2, usedModules: S2, usesTopLevelAwait: k2 };
  }
  setDynamicImportResolutions(e4) {
    const { accessedGlobalsByScope: t2, outputOptions: n2, pluginDriver: s2, snippets: i2 } = this;
    for (const r2 of this.getIncludedDynamicImports())
      if (r2.chunk) {
        const { chunk: o2, facadeChunk: a2, node: l2, resolution: c2 } = r2;
        o2 === this ? l2.setInternalResolution(c2.namespace) : l2.setExternalResolution((a2 || o2).exportMode, c2, n2, i2, s2, t2, `'${(a2 || o2).getImportPath(e4)}'`, !(a2 == null ? void 0 : a2.strictFacade) && o2.exportNamesByVariable.get(c2.namespace)[0], null);
      } else {
        const { node: o2, resolution: a2 } = r2, [l2, c2] = this.getDynamicImportStringAndAttributes(a2, e4);
        o2.setExternalResolution("external", a2, n2, i2, s2, t2, l2, false, c2);
      }
  }
  setIdentifierRenderResolutions() {
    const { format: e4, generatedCode: { symbols: t2 }, interop: n2, preserveModules: s2, externalLiveBindings: i2 } = this.outputOptions, r2 = /* @__PURE__ */ new Set();
    for (const t3 of this.getExportNames()) {
      const n3 = this.exportsByName.get(t3);
      "es" !== e4 && "system" !== e4 && n3.isReassigned && !n3.isId ? n3.setRenderNames("exports", t3) : n3 instanceof Da ? r2.add(n3) : n3.setRenderNames(null, null);
    }
    for (const e5 of this.orderedModules)
      if (e5.needsExportShim) {
        this.needsExportsShim = true;
        break;
      }
    const o2 = /* @__PURE__ */ new Set(["Object", "Promise"]);
    switch (this.needsExportsShim && o2.add(Na), t2 && o2.add("Symbol"), e4) {
      case "system":
        o2.add("module").add("exports");
        break;
      case "es":
        break;
      case "cjs":
        o2.add("module").add("require").add("__filename").add("__dirname");
      default:
        o2.add("exports");
        for (const e5 of Ao)
          o2.add(e5);
    }
    Rl(this.orderedModules, this.getDependenciesToBeDeconflicted("es" !== e4 && "system" !== e4, "amd" === e4 || "umd" === e4 || "iife" === e4, n2), this.imports, o2, e4, n2, s2, i2, this.chunkByModule, this.externalChunkByModule, r2, this.exportNamesByVariable, this.accessedGlobalsByScope, this.includedNamespaces);
  }
  setImportMetaResolutions(e4) {
    const { accessedGlobalsByScope: t2, includedNamespaces: n2, orderedModules: s2, outputOptions: { format: i2 } } = this;
    for (const r2 of s2) {
      for (const n3 of r2.importMetas)
        n3.setResolution(i2, t2, e4);
      n2.has(r2) && r2.namespace.prepare(t2);
    }
  }
  setUpChunkImportsAndExportsForModule(e4) {
    const t2 = new Set(e4.includedImports);
    if (!this.outputOptions.preserveModules && this.includedNamespaces.has(e4)) {
      const n2 = e4.namespace.getMemberVariables();
      for (const e5 of Object.values(n2))
        e5.included && t2.add(e5);
    }
    for (let n2 of t2) {
      n2 instanceof ha && (n2 = n2.getOriginalVariable()), n2 instanceof Da && (n2 = n2.getBaseVariable());
      const t3 = this.chunkByModule.get(n2.module);
      t3 !== this && (this.imports.add(n2), n2.module instanceof il && (this.checkCircularDependencyImport(n2, e4), n2 instanceof Oa && this.outputOptions.preserveModules || t3.exports.add(n2)));
    }
    (this.includedNamespaces.has(e4) || e4.info.isEntry && false !== e4.preserveSignature || e4.includedDynamicImporters.some((e5) => this.chunkByModule.get(e5) !== this)) && this.ensureReexportsAreAvailableForModule(e4);
    for (const { node: t3, resolution: n2 } of e4.dynamicImports)
      t3.included && n2 instanceof il && this.chunkByModule.get(n2) === this && !this.includedNamespaces.has(n2) && (this.includedNamespaces.add(n2), this.ensureReexportsAreAvailableForModule(n2));
  }
}
function Ql(e4) {
  return ec(e4) ?? L(e4.id);
}
function ec(e4) {
  var _a3, _b;
  return ((_a3 = e4.chunkNames.find(({ isUserDefined: e5 }) => e5)) == null ? void 0 : _a3.name) ?? ((_b = e4.chunkNames[0]) == null ? void 0 : _b.name);
}
function tc(e4, t2) {
  const n2 = {};
  for (const [s2, i2] of e4) {
    const e5 = /* @__PURE__ */ new Set();
    if (i2.imports)
      for (const { imported: t3 } of i2.imports)
        e5.add(t3);
    if (i2.reexports)
      for (const { imported: t3 } of i2.reexports)
        e5.add(t3);
    n2[t2(s2)] = [...e5];
  }
  return n2;
}
const nc = /[#?]/, sc = (e4) => e4.getFileName();
function* ic(e4) {
  for (const t2 of e4)
    yield* t2;
}
function rc(e4, t2, n2, s2) {
  const { chunkDefinitions: i2, modulesInManualChunks: r2 } = function(e5) {
    const t3 = [], n3 = new Set(e5.keys()), s3 = /* @__PURE__ */ Object.create(null);
    for (const [t4, i3] of e5)
      oc(t4, s3[i3] || (s3[i3] = []), n3);
    for (const [e6, n4] of Object.entries(s3))
      t3.push({ alias: e6, modules: n4 });
    return { chunkDefinitions: t3, modulesInManualChunks: n3 };
  }(t2), { allEntries: o2, dependentEntriesByModule: a2, dynamicallyDependentEntriesByDynamicEntry: l2, dynamicImportsByEntry: c2 } = function(e5) {
    const t3 = /* @__PURE__ */ new Set(), n3 = /* @__PURE__ */ new Map(), s3 = [], i3 = new Set(e5);
    let r3 = 0;
    for (const e6 of i3) {
      const o4 = /* @__PURE__ */ new Set();
      s3.push(o4);
      const a4 = /* @__PURE__ */ new Set([e6]);
      for (const e7 of a4) {
        j(n3, e7, U).add(r3);
        for (const t4 of e7.getDependenciesToBeIncluded())
          t4 instanceof En || a4.add(t4);
        for (const { resolution: n4 } of e7.dynamicImports)
          n4 instanceof il && n4.includedDynamicImporters.length > 0 && !i3.has(n4) && (t3.add(n4), i3.add(n4), o4.add(n4));
        for (const n4 of e7.implicitlyLoadedBefore)
          i3.has(n4) || (t3.add(n4), i3.add(n4));
      }
      r3++;
    }
    const o3 = [...i3], { dynamicEntries: a3, dynamicImportsByEntry: l3 } = function(e6, t4, n4) {
      const s4 = /* @__PURE__ */ new Map(), i4 = /* @__PURE__ */ new Set();
      for (const [n5, r5] of e6.entries())
        s4.set(r5, n5), t4.has(r5) && i4.add(n5);
      const r4 = [];
      for (const e7 of n4) {
        const t5 = /* @__PURE__ */ new Set();
        for (const n5 of e7)
          t5.add(s4.get(n5));
        r4.push(t5);
      }
      return { dynamicEntries: i4, dynamicImportsByEntry: r4 };
    }(o3, t3, s3);
    return { allEntries: o3, dependentEntriesByModule: n3, dynamicallyDependentEntriesByDynamicEntry: ac(n3, a3, o3), dynamicImportsByEntry: l3 };
  }(e4), u2 = function(e5) {
    var _a3;
    const t3 = /* @__PURE__ */ Object.create(null);
    for (const { dependentEntries: n3, modules: s3 } of e5) {
      let e6 = 0n;
      for (const t4 of n3)
        e6 |= 1n << BigInt(t4);
      (t3[_a3 = String(e6)] || (t3[_a3] = { dependentEntries: new Set(n3), modules: [] })).modules.push(...s3);
    }
    return Object.values(t3);
  }(function* (e5, t3) {
    for (const [n3, s3] of e5)
      t3.has(n3) || (yield { dependentEntries: s3, modules: [n3] });
  }(a2, r2)), d2 = function(e5, t3) {
    const n3 = e5.map(() => 0n);
    let s3 = 1n;
    for (const { dependentEntries: e6 } of t3) {
      for (const t4 of e6)
        n3[t4] |= s3;
      s3 <<= 1n;
    }
    return n3;
  }(o2, u2), h2 = function(e5, t3, n3, s3) {
    const i3 = s3.map((e6, n4) => t3.has(n4) ? -1n : 0n);
    for (const [s4, r3] of t3) {
      t3.delete(s4);
      const o3 = i3[s4];
      let a3 = o3;
      for (const t4 of r3)
        a3 &= e5[t4] | i3[t4];
      if (a3 !== o3) {
        i3[s4] = a3;
        for (const e6 of n3[s4])
          j(t3, e6, U).add(s4);
      }
    }
    return i3;
  }(d2, l2, c2, o2);
  !function(e5, t3) {
    let n3 = 1n;
    for (const { dependentEntries: s3 } of e5) {
      for (const e6 of s3)
        (t3[e6] & n3) === n3 && s3.delete(e6);
      n3 <<= 1n;
    }
  }(u2, h2);
  const { chunks: p2, sideEffectAtoms: f2, sizeByAtom: m2 } = function(e5, t3, n3, s3) {
    var _a3;
    const i3 = /* @__PURE__ */ Object.create(null), r3 = /* @__PURE__ */ new Map(), o3 = [];
    let a3 = 0n, l3 = 1n;
    for (const { dependentEntries: c4, modules: u3 } of e5) {
      let e6 = 0n, d3 = -1n;
      for (const s4 of c4)
        e6 |= 1n << BigInt(s4), d3 &= t3[s4] | n3[s4];
      const h3 = i3[_a3 = String(e6)] || (i3[_a3] = { containedAtoms: 0n, correlatedAtoms: d3, dependencies: /* @__PURE__ */ new Set(), dependentChunks: /* @__PURE__ */ new Set(), dependentEntries: new Set(c4), modules: [], pure: true, size: 0 });
      let p3 = 0, f3 = true;
      for (const e7 of u3)
        r3.set(e7, h3), e7.isIncluded() && (f3 && (f3 = !e7.hasEffects()), p3 += s3 > 1 ? e7.estimateSize() : 1);
      f3 || (a3 |= l3), o3.push(p3), h3.containedAtoms |= l3, h3.modules.push(...u3), h3.pure && (h3.pure = f3), h3.size += p3, l3 <<= 1n;
    }
    const c3 = Object.values(i3);
    return a3 |= function(e6, t4, n4) {
      const s4 = /* @__PURE__ */ new Map();
      let i4 = 0n;
      for (const r4 of e6) {
        const { dependencies: e7, modules: o4 } = r4;
        for (const a4 of o4)
          for (const o5 of a4.getDependenciesToBeIncluded())
            if (o5 instanceof En) {
              if (o5.info.moduleSideEffects) {
                const e8 = j(s4, o5, () => {
                  const e9 = n4;
                  return n4 <<= 1n, i4 |= e9, e9;
                });
                r4.containedAtoms |= e8, r4.correlatedAtoms |= e8;
              }
            } else {
              const n5 = t4.get(o5);
              n5 && n5 !== r4 && (e7.add(n5), n5.dependentChunks.add(r4));
            }
      }
      return i4;
    }(c3, r3, l3), { chunks: c3, sideEffectAtoms: a3, sizeByAtom: o3 };
  }(u2, d2, h2, n2);
  return i2.push(...function(e5, t3, n3, s3, i3) {
    Ja("optimize chunks", 3);
    const r3 = function(e6, t4) {
      const n4 = [], s4 = [];
      for (const i4 of e6)
        (i4.size < t4 ? n4 : s4).push(i4);
      if (0 === n4.length)
        return null;
      return n4.sort(lc), s4.sort(lc), { big: new Set(s4), small: new Set(n4) };
    }(e5, t3);
    if (!r3)
      return Xa("optimize chunks", 3), e5;
    return t3 > 1 && i3("info", cn(e5.length, r3.small.size, "Initially")), function(e6, t4, n4, s4) {
      const { small: i4 } = e6;
      for (const r4 of i4) {
        const o3 = cc(r4, e6, n4, s4, t4 <= 1 ? 1 : 1 / 0);
        if (o3) {
          const { containedAtoms: n5, correlatedAtoms: s5, modules: a3, pure: l3, size: c3 } = r4;
          i4.delete(r4), hc(o3, t4, e6).delete(o3), o3.modules.push(...a3), o3.size += c3, o3.pure && (o3.pure = l3);
          const { dependencies: u3, dependentChunks: d3, dependentEntries: h3 } = o3;
          o3.correlatedAtoms &= s5, o3.containedAtoms |= n5;
          for (const e7 of r4.dependentEntries)
            h3.add(e7);
          for (const e7 of r4.dependencies)
            u3.add(e7), e7.dependentChunks.delete(r4), e7.dependentChunks.add(o3);
          for (const e7 of r4.dependentChunks)
            d3.add(e7), e7.dependencies.delete(r4), e7.dependencies.add(o3);
          u3.delete(o3), d3.delete(o3), hc(o3, t4, e6).add(o3);
        }
      }
    }(r3, t3, n3, s3), t3 > 1 && i3("info", cn(r3.small.size + r3.big.size, r3.small.size, "After merging chunks")), Xa("optimize chunks", 3), [...r3.small, ...r3.big];
  }(p2, n2, f2, m2, s2).map(({ modules: e5 }) => ({ alias: null, modules: e5 }))), i2;
}
function oc(e4, t2, n2) {
  const s2 = /* @__PURE__ */ new Set([e4]);
  for (const e5 of s2) {
    n2.add(e5), t2.push(e5);
    for (const t3 of e5.dependencies)
      t3 instanceof En || n2.has(t3) || s2.add(t3);
  }
}
function ac(e4, t2, n2) {
  const s2 = /* @__PURE__ */ new Map();
  for (const i2 of t2) {
    const t3 = j(s2, i2, U), r2 = n2[i2];
    for (const n3 of ic([r2.includedDynamicImporters, r2.implicitlyLoadedAfter]))
      for (const s3 of e4.get(n3))
        t3.add(s3);
  }
  return s2;
}
function lc({ size: e4 }, { size: t2 }) {
  return e4 - t2;
}
function cc(e4, { big: t2, small: n2 }, s2, i2, r2) {
  let o2 = null;
  for (const a2 of ic([n2, t2])) {
    if (e4 === a2)
      continue;
    const t3 = uc(e4, a2, r2, s2, i2);
    if (t3 < r2) {
      if (o2 = a2, 0 === t3)
        break;
      r2 = t3;
    }
  }
  return o2;
}
function uc(e4, t2, n2, s2, i2) {
  const r2 = dc(e4, t2, n2, s2, i2);
  return r2 < n2 ? r2 + dc(t2, e4, n2 - r2, s2, i2) : 1 / 0;
}
function dc(e4, t2, n2, s2, i2) {
  const { correlatedAtoms: r2 } = t2;
  let o2 = e4.containedAtoms;
  const a2 = o2 & s2;
  if ((r2 & a2) !== a2)
    return 1 / 0;
  const l2 = new Set(e4.dependencies);
  for (const { dependencies: e5, containedAtoms: n3 } of l2) {
    o2 |= n3;
    const i3 = n3 & s2;
    if ((r2 & i3) !== i3)
      return 1 / 0;
    for (const n4 of e5) {
      if (n4 === t2)
        return 1 / 0;
      l2.add(n4);
    }
  }
  return function(e5, t3, n3) {
    let s3 = 0, i3 = 0, r3 = 1n;
    const { length: o3 } = n3;
    for (; i3 < o3; i3++)
      if ((e5 & r3) === r3 && (s3 += n3[i3]), r3 <<= 1n, s3 >= t3)
        return 1 / 0;
    return s3;
  }(o2 & ~r2, n2, i2);
}
function hc(e4, t2, n2) {
  return e4.size < t2 ? n2.small : n2.big;
}
const pc = (e4, t2) => e4.execIndex > t2.execIndex ? 1 : -1;
function fc(e4, t2, n2) {
  const s2 = Symbol(e4.id), i2 = [e4.id];
  let r2 = t2;
  for (e4.cycles.add(s2); r2 !== e4; )
    r2.cycles.add(s2), i2.push(r2.id), r2 = n2.get(r2);
  return i2.push(i2[0]), i2.reverse(), i2;
}
const mc = (e4, t2) => t2 ? `(${e4})` : e4;
class gc {
  constructor(e4, t2) {
    this.isOriginal = true, this.filename = e4, this.content = t2;
  }
  traceSegment(e4, t2, n2) {
    return { column: t2, line: e4, name: n2, source: this };
  }
}
class yc {
  constructor(e4, t2) {
    this.sources = t2, this.names = e4.names, this.mappings = e4.mappings;
  }
  traceMappings() {
    const e4 = [], t2 = /* @__PURE__ */ new Map(), n2 = [], s2 = [], i2 = /* @__PURE__ */ new Map(), r2 = [];
    for (const o2 of this.mappings) {
      const a2 = [];
      for (const r3 of o2) {
        if (1 === r3.length)
          continue;
        const o3 = this.sources[r3[1]];
        if (!o3)
          continue;
        const l2 = o3.traceSegment(r3[2], r3[3], 5 === r3.length ? this.names[r3[4]] : "");
        if (l2) {
          const { column: o4, line: c2, name: u2, source: { content: d2, filename: h2 } } = l2;
          let p2 = t2.get(h2);
          if (void 0 === p2)
            p2 = e4.length, e4.push(h2), t2.set(h2, p2), n2[p2] = d2;
          else if (null == n2[p2])
            n2[p2] = d2;
          else if (null != d2 && n2[p2] !== d2)
            return lt(fn(h2));
          const f2 = [r3[0], p2, c2, o4];
          if (u2) {
            let e5 = i2.get(u2);
            void 0 === e5 && (e5 = s2.length, s2.push(u2), i2.set(u2, e5)), f2[4] = e5;
          }
          a2.push(f2);
        }
      }
      r2.push(a2);
    }
    return { mappings: r2, names: s2, sources: e4, sourcesContent: n2 };
  }
  traceSegment(e4, t2, n2) {
    const s2 = this.mappings[e4];
    if (!s2)
      return null;
    let i2 = 0, r2 = s2.length - 1;
    for (; i2 <= r2; ) {
      const e5 = i2 + r2 >> 1, o2 = s2[e5];
      if (o2[0] === t2 || i2 === r2) {
        if (1 == o2.length)
          return null;
        const e6 = this.sources[o2[1]];
        return e6 ? e6.traceSegment(o2[2], o2[3], 5 === o2.length ? this.names[o2[4]] : n2) : null;
      }
      o2[0] > t2 ? r2 = e5 - 1 : i2 = e5 + 1;
    }
    return null;
  }
}
function bc(e4) {
  return function(t2, n2) {
    return n2.missing ? (e4(Le, (s2 = n2.plugin, { code: jt, message: `Sourcemap is likely to be incorrect: a plugin (${s2}) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help`, plugin: s2, url: Ke(Je) })), new yc({ mappings: [], names: [] }, [t2])) : new yc(n2, [t2]);
    var s2;
  };
}
function Ec(e4, t2, n2, s2, i2) {
  let r2;
  if (n2) {
    const t3 = n2.sources, s3 = n2.sourcesContent || [], i3 = k(e4) || ".", o2 = n2.sourceRoot || ".", a2 = t3.map((e5, t4) => new gc(O(i3, o2, e5), s3[t4]));
    r2 = new yc(n2, a2);
  } else
    r2 = new gc(e4, t2);
  return s2.reduce(i2, r2);
}
let xc;
const $c = (e4) => function(e5) {
  let t2, n2;
  try {
    const r2 = An.__wbindgen_add_to_stack_pointer(-16);
    An.xxhashBase64Url(r2, On(e5));
    var s2 = Ln()[r2 / 4 + 0], i2 = Ln()[r2 / 4 + 1];
    return t2 = s2, n2 = i2, Cn(s2, i2);
  } finally {
    An.__wbindgen_add_to_stack_pointer(16), An.__wbindgen_export_2(t2, n2, 1);
  }
}(Sc(e4)), Ac = { base36: (e4) => function(e5) {
  let t2, n2;
  try {
    const r2 = An.__wbindgen_add_to_stack_pointer(-16);
    An.xxhashBase36(r2, On(e5));
    var s2 = Ln()[r2 / 4 + 0], i2 = Ln()[r2 / 4 + 1];
    return t2 = s2, n2 = i2, Cn(s2, i2);
  } finally {
    An.__wbindgen_add_to_stack_pointer(16), An.__wbindgen_export_2(t2, n2, 1);
  }
}(Sc(e4)), base64: $c, hex: (e4) => function(e5) {
  let t2, n2;
  try {
    const r2 = An.__wbindgen_add_to_stack_pointer(-16);
    An.xxhashBase16(r2, On(e5));
    var s2 = Ln()[r2 / 4 + 0], i2 = Ln()[r2 / 4 + 1];
    return t2 = s2, n2 = i2, Cn(s2, i2);
  } finally {
    An.__wbindgen_add_to_stack_pointer(16), An.__wbindgen_export_2(t2, n2, 1);
  }
}(Sc(e4)) };
function Sc(e4) {
  return "string" == typeof e4 ? "undefined" == typeof Buffer ? (xc ?? (xc = new TextEncoder()), xc.encode(e4)) : Buffer.from(e4) : e4;
}
let wc = "sourceMa";
async function vc(e4, t2, n2, s2, i2) {
  Ja("render chunks", 2), function(e5) {
    for (const t3 of e5)
      t3.facadeModule && t3.facadeModule.isUserDefinedEntryPoint && t3.getPreliminaryFileName();
  }(e4);
  const r2 = await Promise.all(e4.map((e5) => e5.render()));
  Xa("render chunks", 2), Ja("transform chunks", 2);
  const o2 = Ac[s2.hashCharacters], a2 = function(e5) {
    return Object.fromEntries(e5.map((e6) => {
      const t3 = e6.getRenderedChunkInfo();
      return [t3.fileName, t3];
    }));
  }(e4), { initialHashesByPlaceholder: l2, nonHashedChunksWithPlaceholders: c2, renderedChunksByPlaceholder: u2, hashDependenciesByPlaceholder: d2 } = await async function(e5, t3, n3, s3, i3, r3) {
    const o3 = [], a3 = /* @__PURE__ */ new Map(), l3 = /* @__PURE__ */ new Map(), c3 = /* @__PURE__ */ new Map(), u3 = /* @__PURE__ */ new Set();
    for (const { preliminaryFileName: { hashPlaceholder: t4 } } of e5)
      t4 && u3.add(t4);
    return await Promise.all(e5.map(async ({ chunk: e6, preliminaryFileName: { fileName: d3, hashPlaceholder: h3 }, preliminarySourcemapFileName: p2, magicString: f2, usedModules: m2 }) => {
      const g2 = { chunk: e6, fileName: d3, sourcemapFileName: (p2 == null ? void 0 : p2.fileName) ?? null, ...await Pc(f2, d3, m2, t3, n3, s3, r3) }, { code: y2, map: b2 } = g2;
      if (h3) {
        const { containedPlaceholders: t4, transformedCode: n4 } = Wl(y2, u3);
        let r4 = n4;
        const o4 = s3.hookReduceValueSync("augmentChunkHash", "", [e6.getRenderedChunkInfo()], (e7, t5) => (t5 && (e7 += t5), e7));
        o4 && (r4 += o4), a3.set(h3, g2), l3.set(h3, { containedPlaceholders: t4, contentHash: i3(r4) });
      } else
        o3.push(g2);
      const E2 = p2 == null ? void 0 : p2.hashPlaceholder;
      b2 && E2 && c3.set(p2.hashPlaceholder, i3(b2.toString()).slice(0, p2.hashPlaceholder.length));
    })), { hashDependenciesByPlaceholder: l3, initialHashesByPlaceholder: c3, nonHashedChunksWithPlaceholders: o3, renderedChunksByPlaceholder: a3 };
  }(r2, a2, s2, n2, o2, i2), h2 = function(e5, t3, n3, s3, i3) {
    const r3 = new Map(n3);
    for (const [n4, { fileName: o3 }] of e5) {
      let e6 = "";
      const a3 = /* @__PURE__ */ new Set([n4]);
      for (const n5 of a3) {
        const { containedPlaceholders: s4, contentHash: i4 } = t3.get(n5);
        e6 += i4;
        for (const e7 of s4)
          a3.add(e7);
      }
      let l3, c3;
      do {
        c3 && (e6 = c3), c3 = i3(e6).slice(0, n4.length), l3 = Gl(o3, n4, c3);
      } while (s3[ql].has(l3.toLowerCase()));
      s3[l3] = Hl, r3.set(n4, c3);
    }
    return r3;
  }(u2, d2, l2, t2, o2);
  !function(e5, t3, n3, s3, i3, r3) {
    for (const { chunk: s4, code: o3, fileName: a3, sourcemapFileName: l3, map: c3 } of e5.values()) {
      let e6 = Ul(o3, t3);
      const u3 = Ul(a3, t3);
      let d3 = null;
      c3 && (d3 = l3 ? Ul(l3, t3) : `${u3}.map`, c3.file = Ul(c3.file, t3), e6 += Ic(d3, c3, i3, r3)), n3[u3] = s4.finalizeChunk(e6, c3, d3, t3);
    }
    for (const { chunk: e6, code: o3, fileName: a3, sourcemapFileName: l3, map: c3 } of s3) {
      let s4 = t3.size > 0 ? Ul(o3, t3) : o3, u3 = null;
      c3 && (u3 = l3 ? Ul(l3, t3) : `${a3}.map`, s4 += Ic(u3, c3, i3, r3)), n3[a3] = e6.finalizeChunk(s4, c3, u3, t3);
    }
  }(u2, h2, t2, c2, n2, s2), Xa("transform chunks", 2);
}
async function Pc(e4, t2, n2, s2, i2, r2, o2) {
  let l2 = null;
  const c2 = [];
  let u2 = await r2.hookReduceArg0("renderChunk", [e4.toString(), s2[t2], i2, { chunks: s2 }], (e5, t3, n3) => {
    if (null == t3)
      return e5;
    if ("string" == typeof t3 && (t3 = { code: t3, map: void 0 }), null !== t3.map) {
      const e6 = La(t3.map);
      c2.push(e6 || { missing: true, plugin: n3.name });
    }
    return t3.code;
  });
  const { compact: d2, dir: h2, file: p2, sourcemap: f2, sourcemapExcludeSources: m2, sourcemapFile: g2, sourcemapPathTransform: y2, sourcemapIgnoreList: b2 } = i2;
  if (d2 || "\n" === u2[u2.length - 1] || (u2 += "\n"), f2) {
    let s3;
    Ja("sourcemaps", 3), s3 = p2 ? O(g2 || p2) : h2 ? O(h2, t2) : O(t2);
    l2 = function(e5, t3, n3, s4, i3, r3) {
      const o3 = bc(r3), l3 = n3.filter((e6) => !e6.excludeFromSourcemap).map((e6) => Ec(e6.id, e6.originalCode, e6.originalSourcemap, e6.sourcemapChain, o3)), c3 = new yc(t3, l3), u3 = s4.reduce(o3, c3);
      let { sources: d3, sourcesContent: h3, names: p3, mappings: f3 } = u3.traceMappings();
      if (e5) {
        const t4 = k(e5);
        d3 = d3.map((e6) => C(t4, e6)), e5 = I(e5);
      }
      h3 = i3 ? null : h3;
      for (const e6 of n3)
        _a2(e6.originalSourcemap, e6.sourcemapChain);
      return new a({ file: e5, mappings: f3, names: p3, sources: d3, sourcesContent: h3 });
    }(s3, e4.generateDecodedMap({}), n2, c2, m2, o2);
    for (let e5 = 0; e5 < l2.sources.length; ++e5) {
      let t3 = l2.sources[e5];
      const n3 = `${s3}.map`, i3 = b2(t3, n3);
      "boolean" != typeof i3 && lt(yn("sourcemapIgnoreList function must return a boolean.")), i3 && (void 0 === l2.x_google_ignoreList && (l2.x_google_ignoreList = []), l2.x_google_ignoreList.includes(e5) || l2.x_google_ignoreList.push(e5)), y2 && (t3 = y2(t3, n3), "string" != typeof t3 && lt(yn("sourcemapPathTransform function must return a string."))), l2.sources[e5] = P(t3);
    }
    Xa("sourcemaps", 3);
  }
  return { code: u2, map: l2 };
}
function Ic(e4, t2, n2, { sourcemap: s2, sourcemapBaseUrl: i2 }) {
  let r2;
  if ("inline" === s2)
    r2 = t2.toUrl();
  else {
    const s3 = I(e4);
    r2 = i2 ? new URL(s3, i2).toString() : s3, n2.emitFile({ fileName: e4, source: t2.toString(), type: "asset" });
  }
  return "hidden" === s2 ? "" : `//# ${wc}=${r2}
`;
}
wc += "ppingURL";
class kc {
  constructor(e4, t2, n2, s2, i2) {
    this.outputOptions = e4, this.unsetOptions = t2, this.inputOptions = n2, this.pluginDriver = s2, this.graph = i2, this.facadeChunkByModule = /* @__PURE__ */ new Map(), this.includedNamespaces = /* @__PURE__ */ new Set();
  }
  async generate(e4) {
    Ja("GENERATE", 1);
    const t2 = /* @__PURE__ */ Object.create(null), n2 = ((e5) => {
      const t3 = /* @__PURE__ */ new Set();
      return new Proxy(e5, { deleteProperty: (e6, n3) => ("string" == typeof n3 && t3.delete(n3.toLowerCase()), Reflect.deleteProperty(e6, n3)), get: (e6, n3) => n3 === ql ? t3 : Reflect.get(e6, n3), set: (e6, n3, s2) => ("string" == typeof n3 && t3.add(n3.toLowerCase()), Reflect.set(e6, n3, s2)) });
    })(t2);
    this.pluginDriver.setOutputBundle(n2, this.outputOptions);
    try {
      Ja("initialize render", 2), await this.pluginDriver.hookParallel("renderStart", [this.outputOptions, this.inputOptions]), Xa("initialize render", 2), Ja("generate chunks", 2);
      const e5 = /* @__PURE__ */ (() => {
        let e6 = 0;
        return (t4, n3) => {
          if (n3 > 22)
            return lt(yn(`Hashes cannot be longer than 22 characters, received ${n3}. Check the "${t4}" option.`));
          const s2 = `${Vl}${vi(++e6).padStart(n3 - 5, "0")}${Fl}`;
          return s2.length > n3 ? lt(yn(`To generate hashes for this number of chunks (currently ${e6}), you need a minimum hash size of ${s2.length}, received ${n3}. Check the "${t4}" option.`)) : s2;
        };
      })(), t3 = await this.generateChunks(n2, e5);
      t3.length > 1 && function(e6, t4) {
        if ("umd" === e6.format || "iife" === e6.format)
          return lt(on("output.format", tt, "UMD and IIFE output formats are not supported for code-splitting builds", e6.format));
        if ("string" == typeof e6.file)
          return lt(on("output.file", Ze, 'when building multiple chunks, the "output.dir" option must be used, not "output.file". To inline dynamic imports, set the "inlineDynamicImports" option'));
        if (e6.sourcemapFile)
          return lt(on("output.sourcemapFile", at, '"output.sourcemapFile" is only supported for single-file builds'));
        !e6.amd.autoId && e6.amd.id && t4(Le, on("output.amd.id", Xe, 'this option is only properly supported for single-file builds. Use "output.amd.autoId" and "output.amd.basePath" instead'));
      }(this.outputOptions, this.inputOptions.onLog), this.pluginDriver.setChunkInformation(this.facadeChunkByModule);
      for (const e6 of t3)
        e6.generateExports();
      Xa("generate chunks", 2), await vc(t3, n2, this.pluginDriver, this.outputOptions, this.inputOptions.onLog);
    } catch (e5) {
      throw await this.pluginDriver.hookParallel("renderError", [e5]), e5;
    }
    return ((e5) => {
      const t3 = /* @__PURE__ */ new Set(), n3 = Object.values(e5);
      for (const e6 of n3)
        "asset" === e6.type && e6.needsCodeReference && t3.add(e6.fileName);
      for (const e6 of n3)
        if ("chunk" === e6.type)
          for (const n4 of e6.referencedFiles)
            t3.has(n4) && t3.delete(n4);
      for (const n4 of t3)
        delete e5[n4];
    })(n2), Ja("generate bundle", 2), await this.pluginDriver.hookSeq("generateBundle", [this.outputOptions, n2, e4]), this.finaliseAssets(n2), Xa("generate bundle", 2), Xa("GENERATE", 1), t2;
  }
  async addManualChunks(e4) {
    const t2 = /* @__PURE__ */ new Map(), n2 = await Promise.all(Object.entries(e4).map(async ([e5, t3]) => ({ alias: e5, entries: await this.graph.moduleLoader.addAdditionalModules(t3, true) })));
    for (const { alias: e5, entries: s2 } of n2)
      for (const n3 of s2)
        Nc(e5, n3, t2);
    return t2;
  }
  assignManualChunks(e4) {
    const t2 = [], n2 = { getModuleIds: () => this.graph.modulesById.keys(), getModuleInfo: this.graph.getModuleInfo };
    for (const s3 of this.graph.modulesById.values())
      if (s3 instanceof il) {
        const i2 = e4(s3.id, n2);
        "string" == typeof i2 && t2.push([i2, s3]);
      }
    t2.sort(([e5], [t3]) => e5 > t3 ? 1 : e5 < t3 ? -1 : 0);
    const s2 = /* @__PURE__ */ new Map();
    for (const [e5, n3] of t2)
      Nc(e5, n3, s2);
    return s2;
  }
  finaliseAssets(e4) {
    if (this.outputOptions.validate) {
      for (const t2 of Object.values(e4))
        if ("code" in t2)
          try {
            Ta(t2.code);
          } catch (e5) {
            this.inputOptions.onLog(Le, Jt(t2, e5));
          }
    }
    this.pluginDriver.finaliseAssets();
  }
  async generateChunks(e4, t2) {
    const { experimentalMinChunkSize: n2, inlineDynamicImports: s2, manualChunks: i2, preserveModules: r2 } = this.outputOptions, o2 = "object" == typeof i2 ? await this.addManualChunks(i2) : this.assignManualChunks(i2), a2 = function({ compact: e5, generatedCode: { arrowFunctions: t3, constBindings: n3, objectShorthand: s3, reservedNamesAsProps: i3 } }) {
      const { _: r3, n: o3, s: a3 } = e5 ? { _: "", n: "", s: "" } : { _: " ", n: "\n", s: ";" }, l3 = n3 ? "const" : "var", c3 = (e6, { isAsync: t4, name: n4 }) => `${t4 ? "async " : ""}function${n4 ? ` ${n4}` : ""}${r3}(${e6.join(`,${r3}`)})${r3}`, u3 = t3 ? (e6, { isAsync: t4, name: n4 }) => {
        const s4 = 1 === e6.length;
        return `${n4 ? `${l3} ${n4}${r3}=${r3}` : ""}${t4 ? `async${s4 ? " " : r3}` : ""}${s4 ? e6[0] : `(${e6.join(`,${r3}`)})`}${r3}=>${r3}`;
      } : c3, d3 = (e6, { functionReturn: n4, lineBreakIndent: s4, name: i4 }) => [`${u3(e6, { isAsync: false, name: i4 })}${t3 ? s4 ? `${o3}${s4.base}${s4.t}` : "" : `{${s4 ? `${o3}${s4.base}${s4.t}` : r3}${n4 ? "return " : ""}`}`, t3 ? `${i4 ? ";" : ""}${s4 ? `${o3}${s4.base}` : ""}` : `${a3}${s4 ? `${o3}${s4.base}` : r3}}`], h3 = i3 ? (e6) => Oe.test(e6) : (e6) => !Ie.has(e6) && Oe.test(e6);
      return { _: r3, cnst: l3, getDirectReturnFunction: d3, getDirectReturnIifeLeft: (e6, n4, { needsArrowReturnParens: s4, needsWrappedFunction: i4 }) => {
        const [r4, o4] = d3(e6, { functionReturn: true, lineBreakIndent: null, name: null });
        return `${mc(`${r4}${mc(n4, t3 && s4)}${o4}`, t3 || i4)}(`;
      }, getFunctionIntro: u3, getNonArrowFunctionIntro: c3, getObject(e6, { lineBreakIndent: t4 }) {
        const n4 = t4 ? `${o3}${t4.base}${t4.t}` : r3;
        return `{${e6.map(([e7, t5]) => {
          if (null === e7)
            return `${n4}${t5}`;
          const i4 = Me(e7);
          return e7 === t5 && s3 && e7 === i4 ? n4 + e7 : `${n4}${i4}:${r3}${t5}`;
        }).join(",")}${0 === e6.length ? "" : t4 ? `${o3}${t4.base}` : r3}}`;
      }, getPropertyAccess: (e6) => h3(e6) ? `.${e6}` : `[${JSON.stringify(e6)}]`, n: o3, s: a3 };
    }(this.outputOptions), l2 = function(e5) {
      const t3 = [];
      for (const n3 of e5.values())
        n3 instanceof il && (n3.isIncluded() || n3.info.isEntry || n3.includedDynamicImporters.length > 0) && t3.push(n3);
      return t3;
    }(this.graph.modulesById), c2 = function(e5) {
      if (0 === e5.length)
        return "/";
      if (1 === e5.length)
        return k(e5[0]);
      const t3 = e5.slice(1).reduce((e6, t4) => {
        const n3 = t4.split(/\/+|\\+/);
        let s3;
        for (s3 = 0; e6[s3] === n3[s3] && s3 < Math.min(e6.length, n3.length); s3++)
          ;
        return e6.slice(0, s3);
      }, e5[0].split(/\/+|\\+/));
      return t3.length > 1 ? t3.join("/") : "/";
    }(function(e5, t3) {
      const n3 = [];
      for (const s3 of e5)
        (s3.info.isEntry || t3) && w(s3.id) && n3.push(s3.id);
      return n3;
    }(l2, r2)), u2 = function(e5, t3, n3) {
      const s3 = /* @__PURE__ */ new Map();
      for (const i3 of e5.values())
        i3 instanceof En && s3.set(i3, new F(i3, t3, n3));
      return s3;
    }(this.graph.modulesById, this.outputOptions, c2), d2 = [], h2 = /* @__PURE__ */ new Map();
    for (const { alias: i3, modules: p3 } of s2 ? [{ alias: null, modules: l2 }] : r2 ? l2.map((e5) => ({ alias: null, modules: [e5] })) : rc(this.graph.entryModules, o2, n2, this.inputOptions.onLog)) {
      p3.sort(pc);
      const n3 = new Zl(p3, this.inputOptions, this.outputOptions, this.unsetOptions, this.pluginDriver, this.graph.modulesById, h2, u2, this.facadeChunkByModule, this.includedNamespaces, i3, t2, e4, c2, a2);
      d2.push(n3);
    }
    for (const e5 of d2)
      e5.link();
    const p2 = [];
    for (const e5 of d2)
      p2.push(...e5.generateFacades());
    return [...d2, ...p2];
  }
}
function Nc(e4, t2, n2) {
  const s2 = n2.get(t2);
  if ("string" == typeof s2 && s2 !== e4)
    return lt((i2 = t2.id, r2 = e4, o2 = s2, { code: wt, message: `Cannot assign "${B(i2)}" to the "${r2}" chunk as it is already in the "${o2}" chunk.` }));
  var i2, r2, o2;
  n2.set(t2, e4);
}
const Cc = (e4) => () => lt(function(e5) {
  return { code: "NO_FS_IN_BROWSER", message: `Cannot access the file system (via "${e5}") when using the browser build of Rollup. Make sure you supply a plugin with custom resolveId and load hooks to Rollup.`, url: Ke("plugin-development/#a-simple-example") };
}(e4)), Oc = Cc("fs.mkdir"), Dc = Cc("fs.readFile"), Mc = Cc("fs.writeFile");
async function Rc(e4, t2, n2, s2, i2, r2, o2, a2, l2) {
  const c2 = await function(e5, t3, n3, s3, i3, r3, o3, a3) {
    let l3 = null, c3 = null;
    if (i3) {
      l3 = /* @__PURE__ */ new Set();
      for (const n4 of i3)
        e5 === n4.source && t3 === n4.importer && l3.add(n4.plugin);
      c3 = (e6, t4) => ({ ...e6, resolve: (e7, n4, { attributes: r4, custom: o4, isEntry: a4, skipSelf: l4 } = Ae) => (l4 ?? (l4 = true), s3(e7, n4, o4, a4, r4 || Se, l4 ? [...i3, { importer: n4, plugin: t4, source: e7 }] : i3)) });
    }
    return n3.hookFirstAndGetPlugin("resolveId", [e5, t3, { attributes: a3, custom: r3, isEntry: o3 }], c3, l3);
  }(e4, t2, s2, i2, r2, o2, a2, l2);
  return null == c2 ? Cc("path.resolve")() : c2[0];
}
const _c = "at position ", Lc = "at output position ";
const Bc = { delete: () => false, get() {
}, has: () => false, set() {
} };
function Tc(e4) {
  return e4.startsWith(_c) || e4.startsWith(Lc) ? lt({ code: mt, message: "A plugin is trying to use the Rollup cache but is not declaring a plugin name or cacheKey." }) : lt({ code: $t, message: `The plugin name ${e4} is being used twice in the same build. Plugin names must be distinct or provide a cacheKey (please post an issue to the plugin if you are a plugin user).` });
}
const zc = (e4, t2, n2 = Uc) => {
  const { onwarn: s2, onLog: i2 } = e4, r2 = Vc(n2, s2);
  if (i2) {
    const e5 = ze[t2];
    return (t3, n3) => i2(t3, Fc(n3), (t4, n4) => {
      if ("error" === t4)
        return lt(jc(n4));
      ze[t4] >= e5 && r2(t4, jc(n4));
    });
  }
  return r2;
}, Vc = (e4, t2) => t2 ? (n2, s2) => {
  n2 === Le ? t2(Fc(s2), (t3) => e4(Le, jc(t3))) : e4(n2, s2);
} : e4, Fc = (e4) => (Object.defineProperty(e4, "toString", { value: () => e4.message, writable: true }), e4), jc = (e4) => "string" == typeof e4 ? { message: e4 } : "function" == typeof e4 ? jc(e4()) : e4, Uc = (e4, { message: t2 }) => {
  switch (e4) {
    case Le:
      return console.warn(t2);
    case Te:
      return console.debug(t2);
    default:
      return console.info(t2);
  }
};
function Gc(e4, t2, n2, s2, i2 = /$./) {
  const r2 = new Set(t2), o2 = Object.keys(e4).filter((e5) => !(r2.has(e5) || i2.test(e5)));
  o2.length > 0 && s2(Le, function(e5, t3, n3) {
    return { code: Gt, message: `Unknown ${e5}: ${t3.join(", ")}. Allowed options: ${n3.join(", ")}` };
  }(n2, o2, [...r2].sort()));
}
const Wc = { recommended: { annotations: true, correctVarValueBeforeDeclaration: false, manualPureFunctions: we, moduleSideEffects: () => true, propertyReadSideEffects: true, tryCatchDeoptimization: true, unknownGlobalSideEffects: false }, safest: { annotations: true, correctVarValueBeforeDeclaration: true, manualPureFunctions: we, moduleSideEffects: () => true, propertyReadSideEffects: true, tryCatchDeoptimization: true, unknownGlobalSideEffects: true }, smallest: { annotations: true, correctVarValueBeforeDeclaration: false, manualPureFunctions: we, moduleSideEffects: () => false, propertyReadSideEffects: false, tryCatchDeoptimization: false, unknownGlobalSideEffects: false } }, qc = { es2015: { arrowFunctions: true, constBindings: true, objectShorthand: true, reservedNamesAsProps: true, symbols: true }, es5: { arrowFunctions: false, constBindings: false, objectShorthand: false, reservedNamesAsProps: true, symbols: false } }, Hc = (e4, t2, n2, s2, i2) => {
  const r2 = e4 == null ? void 0 : e4.preset;
  if (r2) {
    const i3 = t2[r2];
    if (i3)
      return { ...i3, ...e4 };
    lt(on(`${n2}.preset`, s2, `valid values are ${He(Object.keys(t2))}`, r2));
  }
  return (/* @__PURE__ */ ((e5, t3, n3, s3) => (i3) => {
    if ("string" == typeof i3) {
      const r3 = e5[i3];
      if (r3)
        return r3;
      lt(on(t3, n3, `valid values are ${s3}${He(Object.keys(e5))}. You can also supply an object for more fine-grained control`, i3));
    }
    return /* @__PURE__ */ ((e6) => e6 && "object" == typeof e6 ? e6 : {})(i3);
  })(t2, n2, s2, i2))(e4);
}, Kc = async (e4) => (await async function(e5) {
  do {
    e5 = (await Promise.all(e5)).flat(1 / 0);
  } while (e5.some((e6) => e6 == null ? void 0 : e6.then));
  return e5;
}([e4])).filter(Boolean);
async function Yc(e4, t2, n2, s2) {
  const i2 = t2.id, r2 = [];
  let o2 = null === e4.map ? null : La(e4.map);
  const l2 = e4.code;
  let c2 = e4.ast;
  const u2 = [], d2 = [];
  let h2 = false;
  const p2 = () => h2 = true;
  let f2 = "", m2 = e4.code;
  const y2 = (e5) => (t3, n3) => {
    t3 = jc(t3), n3 && ut(t3, n3, m2, i2), t3.id = i2, t3.hook = "transform", e5(t3);
  };
  let b2;
  try {
    b2 = await n2.hookReduceArg0("transform", [m2, i2], function(e5, n3, i3) {
      let o3, a2;
      if ("string" == typeof n3)
        o3 = n3;
      else {
        if (!n3 || "object" != typeof n3)
          return e5;
        if (t2.updateOptions(n3), null == n3.code)
          return (n3.map || n3.ast) && s2(Le, function(e6) {
            return { code: Tt, message: `The plugin "${e6}" returned a "map" or "ast" without returning a "code". This will be ignored.` };
          }(i3.name)), e5;
        ({ code: o3, map: a2, ast: c2 } = n3);
      }
      return null !== a2 && r2.push(La("string" == typeof a2 ? JSON.parse(a2) : a2) || { missing: true, plugin: i3.name }), m2 = o3, o3;
    }, (e5, t3) => {
      return f2 = t3.name, { ...e5, addWatchFile(t4) {
        u2.push(t4), e5.addWatchFile(t4);
      }, cache: h2 ? e5.cache : (c3 = e5.cache, b3 = p2, { delete: (e6) => (b3(), c3.delete(e6)), get: (e6) => (b3(), c3.get(e6)), has: (e6) => (b3(), c3.has(e6)), set: (e6, t4) => (b3(), c3.set(e6, t4)) }), debug: y2(e5.debug), emitFile: (e6) => (d2.push(e6), n2.emitFile(e6)), error: (t4, n3) => ("string" == typeof t4 && (t4 = { message: t4 }), n3 && ut(t4, n3, m2, i2), t4.id = i2, t4.hook = "transform", e5.error(t4)), getCombinedSourcemap() {
        const e6 = function(e7, t4, n3, s3, i3) {
          return 0 === s3.length ? n3 : La({ version: 3, ...Ec(e7, t4, n3, s3, bc(i3)).traceMappings() });
        }(i2, l2, o2, r2, s2);
        if (!e6) {
          return new g(l2).generateMap({ hires: true, includeContent: true, source: i2 });
        }
        return o2 !== e6 && (o2 = e6, r2.length = 0), new a({ ...e6, file: null, sourcesContent: e6.sourcesContent });
      }, info: y2(e5.info), setAssetSource() {
        return this.error({ code: Ct, message: "setAssetSource cannot be called in transform for caching reasons. Use emitFile with a source, or call setAssetSource in another hook." });
      }, warn: y2(e5.warn) };
      var c3, b3;
    });
  } catch (e5) {
    return lt(pn(e5, f2, { hook: "transform", id: i2 }));
  }
  return !h2 && d2.length > 0 && (t2.transformFiles = d2), { ast: c2, code: b2, customTransformCache: h2, originalCode: l2, originalSourcemap: o2, sourcemapChain: r2, transformDependencies: u2 };
}
const Jc = "resolveDependencies";
class Xc {
  constructor(e4, t2, n2, s2) {
    this.graph = e4, this.modulesById = t2, this.options = n2, this.pluginDriver = s2, this.implicitEntryModules = /* @__PURE__ */ new Set(), this.indexedEntryModules = [], this.latestLoadModulesPromise = Promise.resolve(), this.moduleLoadPromises = /* @__PURE__ */ new Map(), this.modulesWithLoadedDependencies = /* @__PURE__ */ new Set(), this.nextChunkNamePriority = 0, this.nextEntryModuleIndex = 0, this.resolveId = async (e5, t3, n3, s3, i2, r2 = null) => this.getResolvedIdWithDefaults(this.getNormalizedResolvedIdWithoutDefaults(!this.options.external(e5, t3, false) && await Rc(e5, t3, this.options.preserveSymlinks, this.pluginDriver, this.resolveId, r2, n3, "boolean" == typeof s3 ? s3 : !t3, i2), t3, e5), i2), this.hasModuleSideEffects = n2.treeshake ? n2.treeshake.moduleSideEffects : () => true;
  }
  async addAdditionalModules(e4, t2) {
    const n2 = this.extendLoadModulesPromise(Promise.all(e4.map((e5) => this.loadEntryModule(e5, false, void 0, null, t2))));
    return await this.awaitLoadModulesPromise(), n2;
  }
  async addEntryModules(e4, t2) {
    const n2 = this.nextEntryModuleIndex;
    this.nextEntryModuleIndex += e4.length;
    const s2 = this.nextChunkNamePriority;
    this.nextChunkNamePriority += e4.length;
    const i2 = await this.extendLoadModulesPromise(Promise.all(e4.map(({ id: e5, importer: t3 }) => this.loadEntryModule(e5, true, t3, null))).then((i3) => {
      for (const [r2, o2] of i3.entries()) {
        o2.isUserDefinedEntryPoint = o2.isUserDefinedEntryPoint || t2, Qc(o2, e4[r2], t2, s2 + r2);
        const i4 = this.indexedEntryModules.find((e5) => e5.module === o2);
        i4 ? i4.index = Math.min(i4.index, n2 + r2) : this.indexedEntryModules.push({ index: n2 + r2, module: o2 });
      }
      return this.indexedEntryModules.sort(({ index: e5 }, { index: t3 }) => e5 > t3 ? 1 : -1), i3;
    }));
    return await this.awaitLoadModulesPromise(), { entryModules: this.indexedEntryModules.map(({ module: e5 }) => e5), implicitEntryModules: [...this.implicitEntryModules], newEntryModules: i2 };
  }
  async emitChunk({ fileName: e4, id: t2, importer: n2, name: s2, implicitlyLoadedAfterOneOf: i2, preserveSignature: r2 }) {
    const o2 = { fileName: e4 || null, id: t2, importer: n2, name: s2 || null }, a2 = i2 ? await this.addEntryWithImplicitDependants(o2, i2) : (await this.addEntryModules([o2], false)).newEntryModules[0];
    return null != r2 && (a2.preserveSignature = r2), a2;
  }
  async preloadModule(e4) {
    return (await this.fetchModule(this.getResolvedIdWithDefaults(e4, Se), void 0, false, !e4.resolveDependencies || Jc)).info;
  }
  addEntryWithImplicitDependants(e4, t2) {
    const n2 = this.nextChunkNamePriority++;
    return this.extendLoadModulesPromise(this.loadEntryModule(e4.id, false, e4.importer, null).then(async (s2) => {
      if (Qc(s2, e4, false, n2), !s2.info.isEntry) {
        const n3 = await Promise.all(t2.map((t3) => this.loadEntryModule(t3, false, e4.importer, s2.id)));
        if (!s2.info.isEntry) {
          this.implicitEntryModules.add(s2);
          for (const e5 of n3)
            s2.implicitlyLoadedAfter.add(e5);
          for (const e5 of s2.implicitlyLoadedAfter)
            e5.implicitlyLoadedBefore.add(s2);
        }
      }
      return s2;
    }));
  }
  async addModuleSource(e4, t2, n2) {
    let s2;
    try {
      s2 = await this.graph.fileOperationQueue.run(async () => {
        const t3 = await this.pluginDriver.hookFirst("load", [e4]);
        return null !== t3 ? t3 : (this.graph.watchFiles[e4] = true, await Dc(e4, "utf8"));
      });
    } catch (n3) {
      let s3 = `Could not load ${e4}`;
      throw t2 && (s3 += ` (imported by ${B(t2)})`), s3 += `: ${n3.message}`, n3.message = s3, n3;
    }
    const i2 = "string" == typeof s2 ? { code: s2 } : null != s2 && "object" == typeof s2 && "string" == typeof s2.code ? s2 : lt(function(e5) {
      return { code: "BAD_LOADER", message: `Error loading "${B(e5)}": plugin load hook should return a string, a { code, map } object, or nothing/null.` };
    }(e4)), r2 = i2.code;
    65279 === r2.charCodeAt(0) && (i2.code = r2.slice(1));
    const o2 = this.graph.cachedModules.get(e4);
    if (!o2 || o2.customTransformCache || o2.originalCode !== i2.code || await this.pluginDriver.hookFirst("shouldTransformCachedModule", [{ ast: o2.ast, code: o2.code, id: o2.id, meta: o2.meta, moduleSideEffects: o2.moduleSideEffects, resolvedSources: o2.resolvedIds, syntheticNamedExports: o2.syntheticNamedExports }]))
      n2.updateOptions(i2), await n2.setSource(await Yc(i2, n2, this.pluginDriver, this.options.onLog));
    else {
      if (o2.transformFiles)
        for (const e5 of o2.transformFiles)
          this.pluginDriver.emitFile(e5);
      await n2.setSource(o2);
    }
  }
  async awaitLoadModulesPromise() {
    let e4;
    do {
      e4 = this.latestLoadModulesPromise, await e4;
    } while (e4 !== this.latestLoadModulesPromise);
  }
  extendLoadModulesPromise(e4) {
    return this.latestLoadModulesPromise = Promise.all([e4, this.latestLoadModulesPromise]), this.latestLoadModulesPromise.catch(() => {
    }), e4;
  }
  async fetchDynamicDependencies(e4, t2) {
    const n2 = await Promise.all(t2.map((t3) => t3.then(async ([t4, n3]) => null === n3 ? null : "string" == typeof n3 ? (t4.resolution = n3, null) : t4.resolution = await this.fetchResolvedDependency(B(n3.id), e4.id, n3))));
    for (const t3 of n2)
      t3 && (e4.dynamicDependencies.add(t3), t3.dynamicImporters.push(e4.id));
  }
  async fetchModule({ attributes: e4, id: t2, meta: n2, moduleSideEffects: s2, syntheticNamedExports: i2 }, r2, o2, a2) {
    const l2 = this.modulesById.get(t2);
    if (l2 instanceof il)
      return r2 && ja(e4, l2.info.attributes) && this.options.onLog(Le, en(l2.info.attributes, e4, t2, r2)), await this.handleExistingModule(l2, o2, a2), l2;
    if (l2 instanceof En)
      return lt({ code: "EXTERNAL_MODULES_CANNOT_BE_TRANSFORMED_TO_MODULES", message: `${l2.id} is resolved as a module now, but it was an external module before. Please check whether there are conflicts in your Rollup options "external" and "manualChunks", manualChunks cannot include external modules.` });
    const c2 = new il(this.graph, t2, this.options, o2, s2, i2, n2, e4);
    this.modulesById.set(t2, c2);
    const u2 = this.addModuleSource(t2, r2, c2).then(() => [this.getResolveStaticDependencyPromises(c2), this.getResolveDynamicImportPromises(c2), d2]), d2 = tu(u2).then(() => this.pluginDriver.hookParallel("moduleParsed", [c2.info]));
    d2.catch(() => {
    }), this.moduleLoadPromises.set(c2, u2);
    const h2 = await u2;
    return a2 ? a2 === Jc && await d2 : await this.fetchModuleDependencies(c2, ...h2), c2;
  }
  async fetchModuleDependencies(e4, t2, n2, s2) {
    this.modulesWithLoadedDependencies.has(e4) || (this.modulesWithLoadedDependencies.add(e4), await Promise.all([this.fetchStaticDependencies(e4, t2), this.fetchDynamicDependencies(e4, n2)]), e4.linkImports(), await s2);
  }
  fetchResolvedDependency(e4, t2, n2) {
    if (n2.external) {
      const { attributes: s2, external: i2, id: r2, moduleSideEffects: o2, meta: a2 } = n2;
      let l2 = this.modulesById.get(r2);
      if (l2) {
        if (!(l2 instanceof En))
          return lt(function(e5, t3) {
            return { code: "INVALID_EXTERNAL_ID", message: `"${e5}" is imported as an external by "${B(t3)}", but is already an existing non-external module id.` };
          }(e4, t2));
        ja(l2.info.attributes, s2) && this.options.onLog(Le, en(l2.info.attributes, s2, e4, t2));
      } else
        l2 = new En(this.options, r2, o2, a2, "absolute" !== i2 && w(r2), s2), this.modulesById.set(r2, l2);
      return Promise.resolve(l2);
    }
    return this.fetchModule(n2, t2, false, false);
  }
  async fetchStaticDependencies(e4, t2) {
    for (const n2 of await Promise.all(t2.map((t3) => t3.then(([t4, n3]) => this.fetchResolvedDependency(t4, e4.id, n3)))))
      e4.dependencies.add(n2), n2.importers.push(e4.id);
    if (!this.options.treeshake || "no-treeshake" === e4.info.moduleSideEffects)
      for (const t3 of e4.dependencies)
        t3 instanceof il && (t3.importedFromNotTreeshaken = true);
  }
  getNormalizedResolvedIdWithoutDefaults(e4, t2, n2) {
    const { makeAbsoluteExternalsRelative: s2 } = this.options;
    if (e4) {
      if ("object" == typeof e4) {
        const i4 = e4.external || this.options.external(e4.id, t2, true);
        return { ...e4, external: i4 && ("relative" === i4 || !w(e4.id) || true === i4 && eu(e4.id, n2, s2) || "absolute") };
      }
      const i3 = this.options.external(e4, t2, true);
      return { external: i3 && (eu(e4, n2, s2) || "absolute"), id: i3 && s2 ? Zc(e4, t2) : e4 };
    }
    const i2 = s2 ? Zc(n2, t2) : n2;
    return false === e4 || this.options.external(i2, t2, true) ? { external: eu(i2, n2, s2) || "absolute", id: i2 } : null;
  }
  getResolveDynamicImportPromises(e4) {
    return e4.dynamicImports.map(async (t2) => {
      const n2 = await this.resolveDynamicImport(e4, t2.argument, e4.id, Va(t2.node));
      return n2 && "object" == typeof n2 && (t2.id = n2.id), [t2, n2];
    });
  }
  getResolveStaticDependencyPromises(e4) {
    return Array.from(e4.sourcesWithAttributes, async ([t2, n2]) => [t2, e4.resolvedIds[t2] = e4.resolvedIds[t2] || this.handleInvalidResolvedId(await this.resolveId(t2, e4.id, Se, false, n2), t2, e4.id, n2)]);
  }
  getResolvedIdWithDefaults(e4, t2) {
    if (!e4)
      return null;
    const n2 = e4.external || false;
    return { attributes: e4.attributes || t2, external: n2, id: e4.id, meta: e4.meta || {}, moduleSideEffects: e4.moduleSideEffects ?? this.hasModuleSideEffects(e4.id, !!n2), resolvedBy: e4.resolvedBy ?? "rollup", syntheticNamedExports: e4.syntheticNamedExports ?? false };
  }
  async handleExistingModule(e4, t2, n2) {
    const s2 = this.moduleLoadPromises.get(e4);
    if (n2)
      return n2 === Jc ? tu(s2) : s2;
    if (t2) {
      e4.info.isEntry = true, this.implicitEntryModules.delete(e4);
      for (const t3 of e4.implicitlyLoadedAfter)
        t3.implicitlyLoadedBefore.delete(e4);
      e4.implicitlyLoadedAfter.clear();
    }
    return this.fetchModuleDependencies(e4, ...await s2);
  }
  handleInvalidResolvedId(e4, t2, n2, s2) {
    return null === e4 ? v(t2) ? lt(function(e5, t3) {
      return { code: qt, exporter: e5, id: t3, message: `Could not resolve "${e5}" from "${B(t3)}"` };
    }(t2, n2)) : (this.options.onLog(Le, function(e5, t3) {
      return { code: qt, exporter: e5, id: t3, message: `"${e5}" is imported by "${B(t3)}", but could not be resolved – treating it as an external dependency.`, url: Ke("troubleshooting/#warning-treating-module-as-external-dependency") };
    }(t2, n2)), { attributes: s2, external: true, id: t2, meta: {}, moduleSideEffects: this.hasModuleSideEffects(t2, true), resolvedBy: "rollup", syntheticNamedExports: false }) : (e4.external && e4.syntheticNamedExports && this.options.onLog(Le, function(e5, t3) {
      return { code: "EXTERNAL_SYNTHETIC_EXPORTS", exporter: e5, message: `External "${e5}" cannot have "syntheticNamedExports" enabled (imported by "${B(t3)}").` };
    }(t2, n2)), e4);
  }
  async loadEntryModule(e4, t2, n2, s2, i2 = false) {
    const r2 = await Rc(e4, n2, this.options.preserveSymlinks, this.pluginDriver, this.resolveId, null, Se, true, Se);
    if (null == r2)
      return lt(null === s2 ? function(e5) {
        return { code: Wt, message: `Could not resolve entry module "${B(e5)}".` };
      }(e4) : function(e5, t3) {
        return { code: Mt, message: `Module "${B(e5)}" that should be implicitly loaded before "${B(t3)}" could not be resolved.` };
      }(e4, s2));
    const o2 = "object" == typeof r2 && r2.external;
    return false === r2 || o2 ? lt(null === s2 ? o2 && i2 ? { code: "EXTERNAL_MODULES_CANNOT_BE_INCLUDED_IN_MANUAL_CHUNKS", message: `"${e4}" cannot be included in manualChunks because it is resolved as an external module by the "external" option or plugins.` } : function(e5) {
      return { code: Wt, message: `Entry module "${B(e5)}" cannot be external.` };
    }(e4) : function(e5, t3) {
      return { code: Mt, message: `Module "${B(e5)}" that should be implicitly loaded before "${B(t3)}" cannot be external.` };
    }(e4, s2)) : this.fetchModule(this.getResolvedIdWithDefaults("object" == typeof r2 ? r2 : { id: r2 }, Se), void 0, t2, false);
  }
  async resolveDynamicImport(e4, t2, n2, s2) {
    const i2 = await this.pluginDriver.hookFirst("resolveDynamicImport", [t2, n2, { attributes: s2 }]);
    if ("string" != typeof t2)
      return "string" == typeof i2 ? i2 : i2 ? this.getResolvedIdWithDefaults(i2, s2) : null;
    if (null == i2) {
      const i3 = e4.resolvedIds[t2];
      return i3 ? (ja(i3.attributes, s2) && this.options.onLog(Le, en(i3.attributes, s2, t2, n2)), i3) : e4.resolvedIds[t2] = this.handleInvalidResolvedId(await this.resolveId(t2, e4.id, Se, false, s2), t2, e4.id, s2);
    }
    return this.handleInvalidResolvedId(this.getResolvedIdWithDefaults(this.getNormalizedResolvedIdWithoutDefaults(i2, n2, t2), s2), t2, n2, s2);
  }
}
function Zc(e4, t2) {
  return v(e4) ? t2 ? O(t2, "..", e4) : O(e4) : e4;
}
function Qc(e4, { fileName: t2, name: n2 }, s2, i2) {
  var _a3;
  if (null !== t2)
    e4.chunkFileNames.add(t2);
  else if (null !== n2) {
    let t3 = 0;
    for (; ((_a3 = e4.chunkNames[t3]) == null ? void 0 : _a3.priority) < i2; )
      t3++;
    e4.chunkNames.splice(t3, 0, { isUserDefined: s2, name: n2, priority: i2 });
  }
}
function eu(e4, t2, n2) {
  return true === n2 || "ifRelativeSource" === n2 && v(t2) || !w(e4);
}
async function tu(e4) {
  const [t2, n2] = await e4;
  return Promise.all([...t2, ...n2]);
}
class nu extends Ii {
  constructor() {
    super(), this.parent = null, this.variables.set("undefined", new da());
  }
  findVariable(e4) {
    let t2 = this.variables.get(e4);
    return t2 || (t2 = new pi(e4), this.variables.set(e4, t2)), t2;
  }
}
function su(e4, t2, n2, s2, i2) {
  const r2 = s2.sanitizeFileName(e4 || "asset");
  return Yl(Kl("function" == typeof s2.assetFileNames ? s2.assetFileNames({ name: e4, source: t2, type: "asset" }) : s2.assetFileNames, "output.assetFileNames", { ext: () => N(r2).slice(1), extname: () => N(r2), hash: (e5) => n2.slice(0, Math.max(0, e5 || 8)), name: () => r2.slice(0, Math.max(0, r2.length - N(r2).length)) }), i2);
}
function iu(e4, { bundle: t2 }, n2) {
  t2[ql].has(e4.toLowerCase()) ? n2(Le, function(e5) {
    return { code: At, message: `The emitted file "${e5}" overwrites a previously emitted file of the same name.` };
  }(e4)) : t2[e4] = Hl;
}
const ru = /* @__PURE__ */ new Set(["chunk", "asset", "prebuilt-chunk"]);
function ou(e4, t2, n2) {
  if (!("string" == typeof e4 || e4 instanceof Uint8Array)) {
    const e5 = t2.fileName || t2.name || n2;
    return lt(yn(`Could not set source for ${"string" == typeof e5 ? `asset "${e5}"` : "unnamed asset"}, asset source needs to be a string, Uint8Array or Buffer.`));
  }
  return e4;
}
function au(e4, t2) {
  return "string" != typeof e4.fileName ? lt((n2 = e4.name || t2, { code: gt, message: `Plugin error - Unable to get file name for asset "${n2}". Ensure that the source is set and that generate is called first. If you reference assets via import.meta.ROLLUP_FILE_URL_<referenceId>, you need to either have set their source after "renderStart" or need to provide an explicit "fileName" when emitting them.` })) : e4.fileName;
  var n2;
}
function lu(e4, t2) {
  return e4.fileName ? e4.fileName : t2 ? t2.get(e4.module).getFileName() : lt((n2 = e4.fileName || e4.name, { code: bt, message: `Plugin error - Unable to get file name for emitted chunk "${n2}". You can only get file names once chunks have been generated after the "renderStart" hook.` }));
  var n2;
}
class cu {
  constructor(e4, t2, n2) {
    this.graph = e4, this.options = t2, this.facadeChunkByModule = null, this.nextIdBase = 1, this.output = null, this.outputFileEmitters = [], this.emitFile = (e5) => function(e6) {
      return Boolean(e6 && ru.has(e6.type));
    }(e5) ? "prebuilt-chunk" === e5.type ? this.emitPrebuiltChunk(e5) : function(e6) {
      const t3 = e6.fileName || e6.name;
      return !t3 || "string" == typeof t3 && !T(t3);
    }(e5) ? "chunk" === e5.type ? this.emitChunk(e5) : this.emitAsset(e5) : lt(yn(`The "fileName" or "name" properties of emitted chunks and assets must be strings that are neither absolute nor relative paths, received "${e5.fileName || e5.name}".`)) : lt(yn(`Emitted files must be of type "asset", "chunk" or "prebuilt-chunk", received "${e5 && e5.type}".`)), this.finaliseAssets = () => {
      for (const [e5, t3] of this.filesByReferenceId)
        if ("asset" === t3.type && "string" != typeof t3.fileName)
          return lt({ code: "ASSET_SOURCE_MISSING", message: `Plugin error creating asset "${t3.name || e5}" - no asset source set.` });
    }, this.getFileName = (e5) => {
      const t3 = this.filesByReferenceId.get(e5);
      return t3 ? "chunk" === t3.type ? lu(t3, this.facadeChunkByModule) : "prebuilt-chunk" === t3.type ? t3.fileName : au(t3, e5) : lt({ code: "FILE_NOT_FOUND", message: `Plugin error - Unable to get file name for unknown file "${e5}".` });
    }, this.setAssetSource = (e5, t3) => {
      const n3 = this.filesByReferenceId.get(e5);
      if (!n3)
        return lt({ code: "ASSET_NOT_FOUND", message: `Plugin error - Unable to set the source for unknown asset "${e5}".` });
      if ("asset" !== n3.type)
        return lt(yn(`Asset sources can only be set for emitted assets but "${e5}" is an emitted chunk.`));
      if (void 0 !== n3.source)
        return lt({ code: "ASSET_SOURCE_ALREADY_SET", message: `Unable to set the source for asset "${n3.name || e5}", source already set.` });
      const s2 = ou(t3, n3, e5);
      if (this.output)
        this.finalizeAdditionalAsset(n3, s2, this.output);
      else {
        n3.source = s2;
        for (const e6 of this.outputFileEmitters)
          e6.finalizeAdditionalAsset(n3, s2, e6.output);
      }
    }, this.setChunkInformation = (e5) => {
      this.facadeChunkByModule = e5;
    }, this.setOutputBundle = (e5, t3) => {
      const n3 = Ac[t3.hashCharacters], s2 = this.output = { bundle: e5, fileNamesBySource: /* @__PURE__ */ new Map(), getHash: n3, outputOptions: t3 };
      for (const e6 of this.filesByReferenceId.values())
        e6.fileName && iu(e6.fileName, s2, this.options.onLog);
      const i2 = /* @__PURE__ */ new Map();
      for (const e6 of this.filesByReferenceId.values())
        if ("asset" === e6.type && void 0 !== e6.source)
          if (e6.fileName)
            this.finalizeAdditionalAsset(e6, e6.source, s2);
          else {
            j(i2, n3(e6.source), () => []).push(e6);
          }
        else
          "prebuilt-chunk" === e6.type && (this.output.bundle[e6.fileName] = this.createPrebuiltChunk(e6));
      for (const [e6, t4] of i2)
        this.finalizeAssetsWithSameSource(t4, e6, s2);
    }, this.filesByReferenceId = n2 ? new Map(n2.filesByReferenceId) : /* @__PURE__ */ new Map(), n2 == null ? void 0 : n2.addOutputFileEmitter(this);
  }
  addOutputFileEmitter(e4) {
    this.outputFileEmitters.push(e4);
  }
  assignReferenceId(e4, t2) {
    let n2 = t2;
    do {
      n2 = $c(n2).slice(0, 8).replaceAll("-", "$");
    } while (this.filesByReferenceId.has(n2) || this.outputFileEmitters.some(({ filesByReferenceId: e5 }) => e5.has(n2)));
    e4.referenceId = n2, this.filesByReferenceId.set(n2, e4);
    for (const { filesByReferenceId: t3 } of this.outputFileEmitters)
      t3.set(n2, e4);
    return n2;
  }
  createPrebuiltChunk(e4) {
    return { code: e4.code, dynamicImports: [], exports: e4.exports || [], facadeModuleId: null, fileName: e4.fileName, implicitlyLoadedBefore: [], importedBindings: {}, imports: [], isDynamicEntry: false, isEntry: false, isImplicitEntry: false, map: e4.map || null, moduleIds: [], modules: {}, name: e4.fileName, preliminaryFileName: e4.fileName, referencedFiles: [], sourcemapFileName: e4.sourcemapFileName || null, type: "chunk" };
  }
  emitAsset(e4) {
    const t2 = void 0 === e4.source ? void 0 : ou(e4.source, e4, null), n2 = { fileName: e4.fileName, name: e4.name, needsCodeReference: !!e4.needsCodeReference, referenceId: "", source: t2, type: "asset" }, s2 = this.assignReferenceId(n2, e4.fileName || e4.name || String(this.nextIdBase++));
    if (this.output)
      this.emitAssetWithReferenceId(n2, this.output);
    else
      for (const e5 of this.outputFileEmitters)
        e5.emitAssetWithReferenceId(n2, e5.output);
    return s2;
  }
  emitAssetWithReferenceId(e4, t2) {
    const { fileName: n2, source: s2 } = e4;
    n2 && iu(n2, t2, this.options.onLog), void 0 !== s2 && this.finalizeAdditionalAsset(e4, s2, t2);
  }
  emitChunk(e4) {
    if (this.graph.phase > Ma.LOAD_AND_PARSE)
      return lt({ code: "INVALID_ROLLUP_PHASE", message: "Cannot emit chunks after module loading has finished." });
    if ("string" != typeof e4.id)
      return lt(yn(`Emitted chunks need to have a valid string id, received "${e4.id}"`));
    const t2 = { fileName: e4.fileName, module: null, name: e4.name || e4.id, referenceId: "", type: "chunk" };
    return this.graph.moduleLoader.emitChunk(e4).then((e5) => t2.module = e5).catch(() => {
    }), this.assignReferenceId(t2, e4.id);
  }
  emitPrebuiltChunk(e4) {
    if ("string" != typeof e4.code)
      return lt(yn(`Emitted prebuilt chunks need to have a valid string code, received "${e4.code}".`));
    if ("string" != typeof e4.fileName || T(e4.fileName))
      return lt(yn(`The "fileName" property of emitted prebuilt chunks must be strings that are neither absolute nor relative paths, received "${e4.fileName}".`));
    const t2 = { code: e4.code, exports: e4.exports, fileName: e4.fileName, map: e4.map, referenceId: "", type: "prebuilt-chunk" }, n2 = this.assignReferenceId(t2, t2.fileName);
    return this.output && (this.output.bundle[t2.fileName] = this.createPrebuiltChunk(t2)), n2;
  }
  finalizeAdditionalAsset(e4, t2, { bundle: n2, fileNamesBySource: s2, getHash: i2, outputOptions: r2 }) {
    let { fileName: o2, needsCodeReference: a2, referenceId: l2 } = e4;
    if (!o2) {
      const a3 = i2(t2);
      o2 = s2.get(a3), o2 || (o2 = su(e4.name, t2, a3, r2, n2), s2.set(a3, o2));
    }
    const c2 = { ...e4, fileName: o2, source: t2 };
    this.filesByReferenceId.set(l2, c2);
    const u2 = n2[o2];
    "asset" === (u2 == null ? void 0 : u2.type) ? u2.needsCodeReference && (u2.needsCodeReference = a2) : n2[o2] = { fileName: o2, name: e4.name, needsCodeReference: a2, source: t2, type: "asset" };
  }
  finalizeAssetsWithSameSource(e4, t2, { bundle: n2, fileNamesBySource: s2, outputOptions: i2 }) {
    let r2, o2 = "", a2 = true;
    for (const s3 of e4) {
      a2 && (a2 = s3.needsCodeReference);
      const e5 = su(s3.name, s3.source, t2, i2, n2);
      (!o2 || e5.length < o2.length || e5.length === o2.length && e5 < o2) && (o2 = e5, r2 = s3);
    }
    s2.set(t2, o2);
    for (const t3 of e4) {
      const e5 = { ...t3, fileName: o2 };
      this.filesByReferenceId.set(t3.referenceId, e5);
    }
    n2[o2] = { fileName: o2, name: r2.name, needsCodeReference: a2, source: r2.source, type: "asset" };
  }
}
function uu(e4, t2, n2, s2, i2) {
  return ze[e4] < ze[i2] ? Hs : (i3, r2) => {
    null != r2 && n2(Le, { code: It, message: `Plugin "${s2}" tried to add a file position to a log or warning. This is only supported in the "transform" hook at the moment and will be ignored.` }), (i3 = jc(i3)).code && !i3.pluginCode && (i3.pluginCode = i3.code), i3.code = t2, i3.plugin = s2, n2(e4, i3);
  };
}
function du(t2, n2, s2, i2, r2, o2) {
  const { logLevel: a2, onLog: l2 } = i2;
  let c2, u2 = true;
  if ("string" != typeof t2.cacheKey && (t2.name.startsWith(_c) || t2.name.startsWith(Lc) || o2.has(t2.name) ? u2 = false : o2.add(t2.name)), n2)
    if (u2) {
      const e4 = t2.cacheKey || t2.name;
      h2 = n2[e4] || (n2[e4] = /* @__PURE__ */ Object.create(null)), c2 = { delete: (e5) => delete h2[e5], get(e5) {
        const t3 = h2[e5];
        if (t3)
          return t3[0] = 0, t3[1];
      }, has(e5) {
        const t3 = h2[e5];
        return !!t3 && (t3[0] = 0, true);
      }, set(e5, t3) {
        h2[e5] = [0, t3];
      } };
    } else
      d2 = t2.name, c2 = { delete: () => Tc(d2), get: () => Tc(d2), has: () => Tc(d2), set: () => Tc(d2) };
  else
    c2 = Bc;
  var d2, h2;
  return { addWatchFile(e4) {
    s2.watchFiles[e4] = true;
  }, cache: c2, debug: uu(Te, "PLUGIN_LOG", l2, t2.name, a2), emitFile: r2.emitFile.bind(r2), error: (e4) => lt(pn(jc(e4), t2.name)), getFileName: r2.getFileName, getModuleIds: () => s2.modulesById.keys(), getModuleInfo: s2.getModuleInfo, getWatchFiles: () => Object.keys(s2.watchFiles), info: uu(Be, "PLUGIN_LOG", l2, t2.name, a2), load: (e4) => s2.moduleLoader.preloadModule(e4), meta: { rollupVersion: e, watchMode: s2.watchMode }, parse: Ta, resolve: (e4, n3, { attributes: i3, custom: r3, isEntry: o3, skipSelf: a3 } = Ae) => (a3 ?? (a3 = true), s2.moduleLoader.resolveId(e4, n3, r3, o3, i3 || Se, a3 ? [{ importer: n3, plugin: t2, source: e4 }] : null)), setAssetSource: r2.setAssetSource, warn: uu(Le, "PLUGIN_WARNING", l2, t2.name, a2) };
}
const hu = Object.keys({ buildEnd: 1, buildStart: 1, closeBundle: 1, closeWatcher: 1, load: 1, moduleParsed: 1, onLog: 1, options: 1, resolveDynamicImport: 1, resolveId: 1, shouldTransformCachedModule: 1, transform: 1, watchChange: 1 });
class pu {
  constructor(e4, t2, n2, s2, i2) {
    this.graph = e4, this.options = t2, this.pluginCache = s2, this.sortedPlugins = /* @__PURE__ */ new Map(), this.unfulfilledActions = /* @__PURE__ */ new Set(), this.fileEmitter = new cu(e4, t2, i2 && i2.fileEmitter), this.emitFile = this.fileEmitter.emitFile.bind(this.fileEmitter), this.getFileName = this.fileEmitter.getFileName.bind(this.fileEmitter), this.finaliseAssets = this.fileEmitter.finaliseAssets.bind(this.fileEmitter), this.setChunkInformation = this.fileEmitter.setChunkInformation.bind(this.fileEmitter), this.setOutputBundle = this.fileEmitter.setOutputBundle.bind(this.fileEmitter), this.plugins = [...i2 ? i2.plugins : [], ...n2];
    const r2 = /* @__PURE__ */ new Set();
    if (this.pluginContexts = new Map(this.plugins.map((n3) => [n3, du(n3, s2, e4, t2, this.fileEmitter, r2)])), i2)
      for (const e5 of n2)
        for (const n3 of hu)
          n3 in e5 && t2.onLog(Le, (o2 = e5.name, { code: "INPUT_HOOK_IN_OUTPUT_PLUGIN", message: `The "${n3}" hook used by the output plugin ${o2} is a build time hook and will not be run for that plugin. Either this plugin cannot be used as an output plugin, or it should have an option to configure it as an output plugin.` }));
    var o2;
  }
  createOutputPluginDriver(e4) {
    return new pu(this.graph, this.options, e4, this.pluginCache, this);
  }
  getUnfulfilledHookActions() {
    return this.unfulfilledActions;
  }
  hookFirst(e4, t2, n2, s2) {
    return this.hookFirstAndGetPlugin(e4, t2, n2, s2).then((e5) => e5 && e5[0]);
  }
  async hookFirstAndGetPlugin(e4, t2, n2, s2) {
    for (const i2 of this.getSortedPlugins(e4)) {
      if (s2 == null ? void 0 : s2.has(i2))
        continue;
      const r2 = await this.runHook(e4, t2, i2, n2);
      if (null != r2)
        return [r2, i2];
    }
    return null;
  }
  hookFirstSync(e4, t2, n2) {
    for (const s2 of this.getSortedPlugins(e4)) {
      const i2 = this.runHookSync(e4, t2, s2, n2);
      if (null != i2)
        return i2;
    }
    return null;
  }
  async hookParallel(e4, t2, n2) {
    const s2 = [];
    for (const i2 of this.getSortedPlugins(e4))
      i2[e4].sequential ? (await Promise.all(s2), s2.length = 0, await this.runHook(e4, t2, i2, n2)) : s2.push(this.runHook(e4, t2, i2, n2));
    await Promise.all(s2);
  }
  hookReduceArg0(e4, [t2, ...n2], s2, i2) {
    let r2 = Promise.resolve(t2);
    for (const t3 of this.getSortedPlugins(e4))
      r2 = r2.then((r3) => this.runHook(e4, [r3, ...n2], t3, i2).then((e5) => s2.call(this.pluginContexts.get(t3), r3, e5, t3)));
    return r2;
  }
  hookReduceArg0Sync(e4, [t2, ...n2], s2, i2) {
    for (const r2 of this.getSortedPlugins(e4)) {
      const o2 = [t2, ...n2], a2 = this.runHookSync(e4, o2, r2, i2);
      t2 = s2.call(this.pluginContexts.get(r2), t2, a2, r2);
    }
    return t2;
  }
  async hookReduceValue(e4, t2, n2, s2) {
    const i2 = [], r2 = [];
    for (const t3 of this.getSortedPlugins(e4, gu))
      t3[e4].sequential ? (i2.push(...await Promise.all(r2)), r2.length = 0, i2.push(await this.runHook(e4, n2, t3))) : r2.push(this.runHook(e4, n2, t3));
    return i2.push(...await Promise.all(r2)), i2.reduce(s2, await t2);
  }
  hookReduceValueSync(e4, t2, n2, s2, i2) {
    let r2 = t2;
    for (const t3 of this.getSortedPlugins(e4)) {
      const o2 = this.runHookSync(e4, n2, t3, i2);
      r2 = s2.call(this.pluginContexts.get(t3), r2, o2, t3);
    }
    return r2;
  }
  hookSeq(e4, t2, n2) {
    let s2 = Promise.resolve();
    for (const i2 of this.getSortedPlugins(e4))
      s2 = s2.then(() => this.runHook(e4, t2, i2, n2));
    return s2.then(yu);
  }
  getSortedPlugins(e4, t2) {
    return j(this.sortedPlugins, e4, () => fu(e4, this.plugins, t2));
  }
  runHook(e4, t2, n2, s2) {
    const i2 = n2[e4], r2 = "object" == typeof i2 ? i2.handler : i2;
    let o2 = this.pluginContexts.get(n2);
    s2 && (o2 = s2(o2, n2));
    let a2 = null;
    return Promise.resolve().then(() => {
      if ("function" != typeof r2)
        return r2;
      const s3 = r2.apply(o2, t2);
      return (s3 == null ? void 0 : s3.then) ? (a2 = [n2.name, e4, t2], this.unfulfilledActions.add(a2), Promise.resolve(s3).then((e5) => (this.unfulfilledActions.delete(a2), e5))) : s3;
    }).catch((t3) => (null !== a2 && this.unfulfilledActions.delete(a2), lt(pn(t3, n2.name, { hook: e4 }))));
  }
  runHookSync(e4, t2, n2, s2) {
    const i2 = n2[e4], r2 = "object" == typeof i2 ? i2.handler : i2;
    let o2 = this.pluginContexts.get(n2);
    s2 && (o2 = s2(o2, n2));
    try {
      return r2.apply(o2, t2);
    } catch (t3) {
      return lt(pn(t3, n2.name, { hook: e4 }));
    }
  }
}
function fu(e4, t2, n2 = mu) {
  const s2 = [], i2 = [], r2 = [];
  for (const o2 of t2) {
    const t3 = o2[e4];
    if (t3) {
      if ("object" == typeof t3) {
        if (n2(t3.handler, e4, o2), "pre" === t3.order) {
          s2.push(o2);
          continue;
        }
        if ("post" === t3.order) {
          r2.push(o2);
          continue;
        }
      } else
        n2(t3, e4, o2);
      i2.push(o2);
    }
  }
  return [...s2, ...i2, ...r2];
}
function mu(e4, t2, n2) {
  "function" != typeof e4 && lt(function(e5, t3) {
    return { code: Nt, hook: e5, message: `Error running plugin hook "${e5}" for plugin "${t3}", expected a function hook or an object with a "handler" function.`, plugin: t3 };
  }(t2, n2.name));
}
function gu(e4, t2, n2) {
  if ("string" != typeof e4 && "function" != typeof e4)
    return lt(function(e5, t3) {
      return { code: Nt, hook: e5, message: `Error running plugin hook "${e5}" for plugin "${t3}", expected a string, a function hook or an object with a "handler" string or function.`, plugin: t3 };
    }(t2, n2.name));
}
function yu() {
}
class bu {
  constructor(e4) {
    this.maxParallel = e4, this.queue = [], this.workerCount = 0;
  }
  run(e4) {
    return new Promise((t2, n2) => {
      this.queue.push({ reject: n2, resolve: t2, task: e4 }), this.work();
    });
  }
  async work() {
    if (this.workerCount >= this.maxParallel)
      return;
    let e4;
    for (this.workerCount++; e4 = this.queue.shift(); ) {
      const { reject: t2, resolve: n2, task: s2 } = e4;
      try {
        n2(await s2());
      } catch (e5) {
        t2(e5);
      }
    }
    this.workerCount--;
  }
}
class Eu {
  constructor(e4, t2) {
    var _a3, _b;
    if (this.options = e4, this.astLru = function(e5) {
      var t3, n2, s2, i2 = e5;
      function r2(e6, r3) {
        ++t3 > i2 && (s2 = n2, o2(1), ++t3), n2[e6] = r3;
      }
      function o2(e6) {
        t3 = 0, n2 = /* @__PURE__ */ Object.create(null), e6 || (s2 = /* @__PURE__ */ Object.create(null));
      }
      return o2(), { clear: o2, has: function(e6) {
        return void 0 !== n2[e6] || void 0 !== s2[e6];
      }, get: function(e6) {
        var t4 = n2[e6];
        return void 0 !== t4 ? t4 : void 0 !== (t4 = s2[e6]) ? (r2(e6, t4), t4) : void 0;
      }, set: function(e6, t4) {
        void 0 !== n2[e6] ? n2[e6] = t4 : r2(e6, t4);
      } };
    }(5), this.cachedModules = /* @__PURE__ */ new Map(), this.deoptimizationTracker = new ee(), this.entryModules = [], this.modulesById = /* @__PURE__ */ new Map(), this.needsTreeshakingPass = false, this.phase = Ma.LOAD_AND_PARSE, this.scope = new nu(), this.watchFiles = /* @__PURE__ */ Object.create(null), this.watchMode = false, this.externalModules = [], this.implicitEntryModules = [], this.modules = [], this.getModuleInfo = (e5) => {
      const t3 = this.modulesById.get(e5);
      return t3 ? t3.info : null;
    }, false !== e4.cache) {
      if ((_a3 = e4.cache) == null ? void 0 : _a3.modules)
        for (const t3 of e4.cache.modules)
          this.cachedModules.set(t3.id, t3);
      this.pluginCache = ((_b = e4.cache) == null ? void 0 : _b.plugins) || /* @__PURE__ */ Object.create(null);
      for (const e5 in this.pluginCache) {
        const t3 = this.pluginCache[e5];
        for (const e6 of Object.values(t3))
          e6[0]++;
      }
    }
    if (t2) {
      this.watchMode = true;
      const e5 = (...e6) => this.pluginDriver.hookParallel("watchChange", e6), n2 = () => this.pluginDriver.hookParallel("closeWatcher", []);
      t2.onCurrentRun("change", e5), t2.onCurrentRun("close", n2);
    }
    this.pluginDriver = new pu(this, e4, e4.plugins, this.pluginCache), this.moduleLoader = new Xc(this, this.modulesById, this.options, this.pluginDriver), this.fileOperationQueue = new bu(e4.maxParallelFileOps), this.pureFunctions = (({ treeshake: e5 }) => {
      const t3 = /* @__PURE__ */ Object.create(null);
      for (const n2 of e5 ? e5.manualPureFunctions : []) {
        let e6 = t3;
        for (const t4 of n2.split("."))
          e6 = e6[t4] || (e6[t4] = /* @__PURE__ */ Object.create(null));
        e6[qs] = true;
      }
      return t3;
    })(e4);
  }
  async build() {
    Ja("generate module graph", 2), await this.generateModuleGraph(), Xa("generate module graph", 2), Ja("sort and bind modules", 2), this.phase = Ma.ANALYSE, this.sortModules(), Xa("sort and bind modules", 2), Ja("mark included statements", 2), this.includeStatements(), Xa("mark included statements", 2), this.phase = Ma.GENERATE;
  }
  getCache() {
    for (const e4 in this.pluginCache) {
      const t2 = this.pluginCache[e4];
      let n2 = true;
      for (const [e5, s2] of Object.entries(t2))
        s2[0] >= this.options.experimentalCacheExpiry ? delete t2[e5] : n2 = false;
      n2 && delete this.pluginCache[e4];
    }
    return { modules: this.modules.map((e4) => e4.toJSON()), plugins: this.pluginCache };
  }
  async generateModuleGraph() {
    var e4;
    if ({ entryModules: this.entryModules, implicitEntryModules: this.implicitEntryModules } = await this.moduleLoader.addEntryModules((e4 = this.options.input, Array.isArray(e4) ? e4.map((e5) => ({ fileName: null, id: e5, implicitlyLoadedAfter: [], importer: void 0, name: null })) : Object.entries(e4).map(([e5, t2]) => ({ fileName: null, id: t2, implicitlyLoadedAfter: [], importer: void 0, name: e5 }))), true), 0 === this.entryModules.length)
      throw new Error("You must supply options.input to rollup");
    for (const e5 of this.modulesById.values())
      e5.cacheInfoGetters(), e5 instanceof il ? this.modules.push(e5) : this.externalModules.push(e5);
  }
  includeStatements() {
    const e4 = [...this.entryModules, ...this.implicitEntryModules];
    for (const t2 of e4)
      el(t2);
    if (this.options.treeshake) {
      let t2 = 1;
      do {
        Ja(`treeshaking pass ${t2}`, 3), this.needsTreeshakingPass = false;
        for (const e5 of this.modules)
          e5.isExecuted && ("no-treeshake" === e5.info.moduleSideEffects ? e5.includeAllInBundle() : e5.include());
        if (1 === t2)
          for (const t3 of e4)
            false !== t3.preserveSignature && (t3.includeAllExports(false), this.needsTreeshakingPass = true);
        Xa("treeshaking pass " + t2++, 3);
      } while (this.needsTreeshakingPass);
    } else
      for (const e5 of this.modules)
        e5.includeAllInBundle();
    for (const e5 of this.externalModules)
      e5.warnUnusedImports();
    for (const e5 of this.implicitEntryModules)
      for (const t2 of e5.implicitlyLoadedAfter)
        t2.info.isEntry || t2.isIncluded() || lt(ln(t2));
  }
  sortModules() {
    const { orderedModules: e4, cyclePaths: t2 } = function(e5) {
      let t3 = 0;
      const n2 = [], s2 = /* @__PURE__ */ new Set(), i2 = /* @__PURE__ */ new Set(), r2 = /* @__PURE__ */ new Map(), o2 = [], a2 = (e6) => {
        if (e6 instanceof il) {
          for (const t4 of e6.dependencies)
            r2.has(t4) ? s2.has(t4) || n2.push(fc(t4, e6, r2)) : (r2.set(t4, e6), a2(t4));
          for (const t4 of e6.implicitlyLoadedBefore)
            i2.add(t4);
          for (const { resolution: t4 } of e6.dynamicImports)
            t4 instanceof il && i2.add(t4);
          o2.push(e6);
        }
        e6.execIndex = t3++, s2.add(e6);
      };
      for (const t4 of e5)
        r2.has(t4) || (r2.set(t4, null), a2(t4));
      for (const e6 of i2)
        r2.has(e6) || (r2.set(e6, null), a2(e6));
      return { cyclePaths: n2, orderedModules: o2 };
    }(this.entryModules);
    for (const e5 of t2)
      this.options.onLog(Le, Xt(e5));
    this.modules = e4;
    for (const e5 of this.modules)
      e5.bindReferences();
    this.warnForMissingExports();
  }
  warnForMissingExports() {
    for (const e4 of this.modules)
      for (const t2 of e4.importDescriptions.values())
        "*" === t2.name || t2.module.getVariableForExportName(t2.name)[0] || e4.log(Le, an(t2.name, e4.id, t2.module.id), t2.start);
  }
}
function xu(e4, t2) {
  return t2();
}
function $u(t2, n2, s2, i2) {
  t2 = fu("onLog", t2);
  const r2 = ze[i2], o2 = (i3, a2, l2 = ve) => {
    ht(a2);
    if (!(ze[i3] < r2)) {
      for (const n3 of t2) {
        if (l2.has(n3))
          continue;
        const { onLog: t3 } = n3, c2 = (e4) => ze[e4] < r2 ? Hs : (t4) => o2(e4, jc(t4), new Set(l2).add(n3));
        if (false === ("handler" in t3 ? t3.handler : t3).call({ debug: c2(Te), error: (e4) => lt(jc(e4)), info: c2(Be), meta: { rollupVersion: e, watchMode: s2 }, warn: c2(Le) }, i3, a2))
          return;
      }
      n2(i3, a2);
    }
  };
  return o2;
}
const Au = (e4) => {
  var _a3;
  return true === e4.cache ? void 0 : ((_a3 = e4.cache) == null ? void 0 : _a3.cache) || e4.cache;
}, Su = (e4) => {
  if (true === e4)
    return () => true;
  if ("function" == typeof e4)
    return (t3, ...n2) => !t3.startsWith("\0") && e4(t3, ...n2) || false;
  if (e4) {
    const n2 = /* @__PURE__ */ new Set(), s2 = [];
    for (const i2 of (t2 = e4, Array.isArray(t2) ? t2.filter(Boolean) : t2 ? [t2] : []))
      i2 instanceof RegExp ? s2.push(i2) : n2.add(i2);
    return (e5, ...t3) => n2.has(e5) || s2.some((t4) => t4.test(e5));
  }
  var t2;
  return () => false;
}, wu = (e4) => {
  const t2 = e4.input;
  return null == t2 ? [] : "string" == typeof t2 ? [t2] : t2;
}, vu = (e4) => {
  const t2 = e4.maxParallelFileOps;
  return "number" == typeof t2 ? t2 <= 0 ? 1 / 0 : t2 : 20;
}, Pu = (e4, t2) => {
  const n2 = e4.moduleContext;
  if ("function" == typeof n2)
    return (e5) => n2(e5) ?? t2;
  if (n2) {
    const e5 = /* @__PURE__ */ Object.create(null);
    for (const [t3, s2] of Object.entries(n2))
      e5[O(t3)] = s2;
    return (n3) => e5[n3] ?? t2;
  }
  return () => t2;
}, Iu = (e4) => {
  if (false === e4.treeshake)
    return false;
  const t2 = Hc(e4.treeshake, Wc, "treeshake", "configuration-options/#treeshake", "false, true, ");
  return { annotations: false !== t2.annotations, correctVarValueBeforeDeclaration: true === t2.correctVarValueBeforeDeclaration, manualPureFunctions: t2.manualPureFunctions ?? we, moduleSideEffects: ku(t2.moduleSideEffects), propertyReadSideEffects: "always" === t2.propertyReadSideEffects ? "always" : false !== t2.propertyReadSideEffects, tryCatchDeoptimization: false !== t2.tryCatchDeoptimization, unknownGlobalSideEffects: false !== t2.unknownGlobalSideEffects };
}, ku = (e4) => {
  if ("boolean" == typeof e4)
    return () => e4;
  if ("no-external" === e4)
    return (e5, t2) => !t2;
  if ("function" == typeof e4)
    return (t2, n2) => !!t2.startsWith("\0") || false !== e4(t2, n2);
  if (Array.isArray(e4)) {
    const t2 = new Set(e4);
    return (e5) => t2.has(e5);
  }
  return e4 && lt(on("treeshake.moduleSideEffects", "configuration-options/#treeshake-modulesideeffects", 'please use one of false, "no-external", a function or an array')), () => true;
}, Nu = /[\u0000-\u001F"#$&*+,:;<=>?[\]^`{|}\u007F]/g, Cu = /^[a-z]:/i;
function Ou(e4) {
  const t2 = Cu.exec(e4), n2 = t2 ? t2[0] : "";
  return n2 + e4.slice(n2.length).replace(Nu, "_");
}
const Du = (e4, t2, n2) => {
  const { file: s2 } = e4;
  if ("string" == typeof s2) {
    if (t2)
      return lt(on("output.file", Ze, 'you must set "output.dir" instead of "output.file" when using the "output.preserveModules" option'));
    if (!Array.isArray(n2.input))
      return lt(on("output.file", Ze, 'you must set "output.dir" instead of "output.file" when providing named inputs'));
  }
  return s2;
}, Mu = (e4) => {
  const t2 = e4.format;
  switch (t2) {
    case void 0:
    case "es":
    case "esm":
    case "module":
      return "es";
    case "cjs":
    case "commonjs":
      return "cjs";
    case "system":
    case "systemjs":
      return "system";
    case "amd":
    case "iife":
    case "umd":
      return t2;
    default:
      return lt(on("output.format", tt, 'Valid values are "amd", "cjs", "system", "es", "iife" or "umd"', t2));
  }
}, Ru = (e4, t2) => {
  const n2 = e4.inlineDynamicImports || false, { input: s2 } = t2;
  return n2 && (Array.isArray(s2) ? s2 : Object.keys(s2)).length > 1 ? lt(on("output.inlineDynamicImports", st, 'multiple inputs are not supported when "output.inlineDynamicImports" is true')) : n2;
}, _u = (e4, t2, n2) => {
  const s2 = e4.preserveModules || false;
  if (s2) {
    if (t2)
      return lt(on("output.inlineDynamicImports", st, 'this option is not supported for "output.preserveModules"'));
    if (false === n2.preserveEntrySignatures)
      return lt(on("preserveEntrySignatures", "configuration-options/#preserveentrysignatures", 'setting this option to false is not supported for "output.preserveModules"'));
  }
  return s2;
}, Lu = (e4) => {
  const { preserveModulesRoot: t2 } = e4;
  if (null != t2)
    return O(t2);
}, Bu = (e4) => {
  const t2 = { autoId: false, basePath: "", define: "define", forceJsExtensionForImports: false, ...e4.amd };
  return (t2.autoId || t2.basePath) && t2.id ? lt(on("output.amd.id", Xe, 'this option cannot be used together with "output.amd.autoId"/"output.amd.basePath"')) : t2.basePath && !t2.autoId ? lt(on("output.amd.basePath", "configuration-options/#output-amd-basepath", 'this option only works with "output.amd.autoId"')) : t2.autoId ? { autoId: true, basePath: t2.basePath, define: t2.define, forceJsExtensionForImports: t2.forceJsExtensionForImports } : { autoId: false, define: t2.define, forceJsExtensionForImports: t2.forceJsExtensionForImports, id: t2.id };
}, Tu = (e4, t2) => {
  const n2 = e4[t2];
  return "function" == typeof n2 ? n2 : () => n2 || "";
}, zu = (e4, t2) => {
  const { dir: n2 } = e4;
  return "string" == typeof n2 && "string" == typeof t2 ? lt(on("output.dir", Ze, 'you must set either "output.file" for a single-file build or "output.dir" when generating multiple chunks')) : n2;
}, Vu = (e4, t2) => {
  const n2 = e4.entryFileNames;
  return null == n2 && t2.add("entryFileNames"), n2 ?? "[name].js";
};
function Fu(e4, t2) {
  const n2 = e4.exports;
  if (null == n2)
    t2.add("exports");
  else if (!["default", "named", "none", "auto"].includes(n2))
    return lt({ code: vt, message: `"output.exports" must be "default", "named", "none", "auto", or left unspecified (defaults to "auto"), received "${n2}".`, url: Ke(Qe) });
  return n2 || "auto";
}
const ju = (e4, t2) => (null != e4.externalImportAssertions && bn('The "output.externalImportAssertions" option is deprecated. Use the "output.externalImportAttributes" option instead.', "configuration-options/#output-externalimportattributes", 0, t2), e4.externalImportAttributes ?? e4.externalImportAssertions ?? true), Uu = (e4) => {
  const t2 = Hc(e4.generatedCode, qc, "output.generatedCode", "configuration-options/#output-generatedcode", "");
  return { arrowFunctions: true === t2.arrowFunctions, constBindings: true === t2.constBindings, objectShorthand: true === t2.objectShorthand, reservedNamesAsProps: false !== t2.reservedNamesAsProps, symbols: true === t2.symbols };
}, Gu = (e4, t2) => {
  if (t2)
    return "";
  const n2 = e4.indent;
  return false === n2 ? "" : n2 ?? true;
}, Wu = /* @__PURE__ */ new Set(["compat", "auto", "esModule", "default", "defaultOnly"]), qu = (e4) => {
  const t2 = e4.interop;
  if ("function" == typeof t2) {
    const e5 = /* @__PURE__ */ Object.create(null);
    let n2 = null;
    return (s2) => null === s2 ? n2 || Hu(n2 = t2(s2)) : s2 in e5 ? e5[s2] : Hu(e5[s2] = t2(s2));
  }
  return void 0 === t2 ? () => "default" : () => Hu(t2);
}, Hu = (e4) => Wu.has(e4) ? e4 : lt(on("output.interop", it, `use one of ${Array.from(Wu, (e5) => JSON.stringify(e5)).join(", ")}`, e4)), Ku = (e4, t2, n2) => {
  const s2 = e4.manualChunks;
  if (s2) {
    if (t2)
      return lt(on("output.manualChunks", rt, 'this option is not supported for "output.inlineDynamicImports"'));
    if (n2)
      return lt(on("output.manualChunks", rt, 'this option is not supported for "output.preserveModules"'));
  }
  return s2 || {};
}, Yu = (e4, t2, n2) => e4.minifyInternalExports ?? (n2 || "es" === t2 || "system" === t2), Ju = (e4, t2) => {
  const n2 = e4.sourcemapFileNames;
  return null == n2 && t2.add("sourcemapFileNames"), n2;
}, Xu = (e4) => {
  const { sourcemapBaseUrl: t2 } = e4;
  if (t2)
    return function(e5) {
      try {
        new URL(e5);
      } catch {
        return false;
      }
      return true;
    }(t2) ? (n2 = t2).endsWith("/") ? n2 : n2 + "/" : lt(on("output.sourcemapBaseUrl", "configuration-options/#output-sourcemapbaseurl", `must be a valid URL, received ${JSON.stringify(t2)}`));
  var n2;
};
function Zu(t2) {
  return async function(t3, n2) {
    const { options: s2, unsetOptions: i2 } = await async function(t4, n3) {
      if (!t4)
        throw new Error("You must supply an options object to rollup");
      const s3 = await async function(t5, n4) {
        const s4 = fu("options", await Kc(t5.plugins)), i4 = t5.logLevel || Be, r4 = $u(s4, zc(t5, i4), n4, i4);
        for (const o3 of s4) {
          const { name: s5, options: a3 } = o3, l2 = "handler" in a3 ? a3.handler : a3, c2 = await l2.call({ debug: uu(Te, "PLUGIN_LOG", r4, s5, i4), error: (e4) => lt(pn(jc(e4), s5, { hook: "onLog" })), info: uu(Be, "PLUGIN_LOG", r4, s5, i4), meta: { rollupVersion: e, watchMode: n4 }, warn: uu(Le, "PLUGIN_WARNING", r4, s5, i4) }, t5);
          c2 && (t5 = c2);
        }
        return t5;
      }(t4, n3), { options: i3, unsetOptions: r3 } = await async function(e4, t5) {
        const n4 = /* @__PURE__ */ new Set(), s4 = e4.context ?? "undefined", i4 = await Kc(e4.plugins), r4 = e4.logLevel || Be, o3 = $u(i4, zc(e4, r4), t5, r4), a3 = e4.strictDeprecations || false, l2 = vu(e4), c2 = { cache: Au(e4), context: s4, experimentalCacheExpiry: e4.experimentalCacheExpiry ?? 10, experimentalLogSideEffects: e4.experimentalLogSideEffects || false, external: Su(e4.external), input: wu(e4), logLevel: r4, makeAbsoluteExternalsRelative: e4.makeAbsoluteExternalsRelative ?? "ifRelativeSource", maxParallelFileOps: l2, moduleContext: Pu(e4, s4), onLog: o3, perf: e4.perf || false, plugins: i4, preserveEntrySignatures: e4.preserveEntrySignatures ?? "exports-only", preserveSymlinks: e4.preserveSymlinks || false, shimMissingExports: e4.shimMissingExports || false, strictDeprecations: a3, treeshake: Iu(e4) };
        return Gc(e4, [...Object.keys(c2), "onwarn", "watch"], "input options", o3, /^(output)$/), { options: c2, unsetOptions: n4 };
      }(s3, n3);
      return Qu(i3.plugins, _c), { options: i3, unsetOptions: r3 };
    }(t3, null !== n2);
    (function(e4) {
      e4.perf ? (Wa = /* @__PURE__ */ new Map(), Ja = Ha, Xa = Ka, e4.plugins = e4.plugins.map(Qa)) : (Ja = Hs, Xa = Hs);
    })(s2), await async function() {
      await Vn();
    }();
    const r2 = new Eu(s2, n2), o2 = false !== t3.cache;
    t3.cache && (s2.cache = void 0, t3.cache = void 0);
    Ja("BUILD", 1), await xu(r2.pluginDriver, async () => {
      try {
        Ja("initialize", 2), await r2.pluginDriver.hookParallel("buildStart", [s2]), Xa("initialize", 2), await r2.build();
      } catch (e4) {
        const t4 = Object.keys(r2.watchFiles);
        throw t4.length > 0 && (e4.watchFiles = t4), await r2.pluginDriver.hookParallel("buildEnd", [e4]), await r2.pluginDriver.hookParallel("closeBundle", []), e4;
      }
      await r2.pluginDriver.hookParallel("buildEnd", []);
    }), Xa("BUILD", 1);
    const a2 = { cache: o2 ? r2.getCache() : void 0, async close() {
      a2.closed || (a2.closed = true, await r2.pluginDriver.hookParallel("closeBundle", []));
    }, closed: false, generate: async (e4) => a2.closed ? lt(Kt()) : ed(false, s2, i2, e4, r2), get watchFiles() {
      return Object.keys(r2.watchFiles);
    }, write: async (e4) => a2.closed ? lt(Kt()) : ed(true, s2, i2, e4, r2) };
    s2.perf && (a2.getTimings = Ya);
    return a2;
  }(t2, null);
}
function Qu(e4, t2) {
  for (const [n2, s2] of e4.entries())
    s2.name || (s2.name = `${t2}${n2 + 1}`);
}
async function ed(e4, t2, n2, s2, i2) {
  const { options: r2, outputPluginDriver: o2, unsetOptions: a2 } = await async function(e5, t3, n3, s3) {
    if (!e5)
      throw new Error("You must supply an options object");
    const i3 = await Kc(e5.plugins);
    Qu(i3, Lc);
    const r3 = t3.createOutputPluginDriver(i3);
    return { ...await td(n3, s3, e5, r3), outputPluginDriver: r3 };
  }(s2, i2.pluginDriver, t2, n2);
  return xu(0, async () => {
    const n3 = new kc(r2, a2, t2, o2, i2), s3 = await n3.generate(e4);
    if (e4) {
      if (Ja("WRITE", 1), !r2.dir && !r2.file)
        return lt({ code: Lt, message: 'You must specify "output.file" or "output.dir" for the build.', url: Ke(Ze) });
      await Promise.all(Object.values(s3).map((e5) => i2.fileOperationQueue.run(() => async function(e6, t3) {
        const n4 = O(t3.dir || k(t3.file), e6.fileName);
        return await Oc(k(n4), { recursive: true }), Mc(n4, "asset" === e6.type ? e6.source : e6.code);
      }(e5, r2)))), await o2.hookParallel("writeBundle", [r2, s3]), Xa("WRITE", 1);
    }
    return l2 = s3, { output: Object.values(l2).filter((e5) => Object.keys(e5).length > 0).sort((e5, t3) => sd(e5) - sd(t3)) };
    var l2;
  });
}
function td(e4, t2, n2, s2) {
  return async function(e5, t3, n3) {
    const s3 = new Set(n3), i2 = e5.compact || false, r2 = Mu(e5), o2 = Ru(e5, t3), a2 = _u(e5, o2, t3), l2 = Du(e5, a2, t3), c2 = Uu(e5), u2 = ju(e5, t3), d2 = { amd: Bu(e5), assetFileNames: e5.assetFileNames ?? "assets/[name]-[hash][extname]", banner: Tu(e5, "banner"), chunkFileNames: e5.chunkFileNames ?? "[name]-[hash].js", compact: i2, dir: zu(e5, l2), dynamicImportInCjs: e5.dynamicImportInCjs ?? true, entryFileNames: Vu(e5, s3), esModule: e5.esModule ?? "if-default-prop", experimentalMinChunkSize: e5.experimentalMinChunkSize ?? 1, exports: Fu(e5, s3), extend: e5.extend || false, externalImportAssertions: u2, externalImportAttributes: u2, externalLiveBindings: e5.externalLiveBindings ?? true, file: l2, footer: Tu(e5, "footer"), format: r2, freeze: e5.freeze ?? true, generatedCode: c2, globals: e5.globals || {}, hashCharacters: e5.hashCharacters ?? "base64", hoistTransitiveImports: e5.hoistTransitiveImports ?? true, importAttributesKey: e5.importAttributesKey ?? "assert", indent: Gu(e5, i2), inlineDynamicImports: o2, interop: qu(e5), intro: Tu(e5, "intro"), manualChunks: Ku(e5, o2, a2), minifyInternalExports: Yu(e5, r2, i2), name: e5.name, noConflict: e5.noConflict || false, outro: Tu(e5, "outro"), paths: e5.paths || {}, plugins: await Kc(e5.plugins), preserveModules: a2, preserveModulesRoot: Lu(e5), reexportProtoFromExternal: e5.reexportProtoFromExternal ?? true, sanitizeFileName: "function" == typeof e5.sanitizeFileName ? e5.sanitizeFileName : false === e5.sanitizeFileName ? (e6) => e6 : Ou, sourcemap: e5.sourcemap || false, sourcemapBaseUrl: Xu(e5), sourcemapExcludeSources: e5.sourcemapExcludeSources || false, sourcemapFile: e5.sourcemapFile, sourcemapFileNames: Ju(e5, s3), sourcemapIgnoreList: "function" == typeof e5.sourcemapIgnoreList ? e5.sourcemapIgnoreList : false === e5.sourcemapIgnoreList ? () => false : (e6) => e6.includes("node_modules"), sourcemapPathTransform: e5.sourcemapPathTransform, strict: e5.strict ?? true, systemNullSetters: e5.systemNullSetters ?? true, validate: e5.validate || false };
    return Gc(e5, Object.keys(d2), "output options", t3.onLog), { options: d2, unsetOptions: s3 };
  }(s2.hookReduceArg0Sync("outputOptions", [n2], (e5, t3) => t3 || e5, (e5) => {
    const t3 = () => e5.error({ code: yt, message: 'Cannot emit files or set asset sources in the "outputOptions" hook, use the "renderStart" hook instead.' });
    return { ...e5, emitFile: t3, setAssetSource: t3 };
  }), e4, t2);
}
var nd;
function sd(e4) {
  return "asset" === e4.type ? nd.ASSET : e4.isEntry ? nd.ENTRY_CHUNK : nd.SECONDARY_CHUNK;
}
!function(e4) {
  e4[e4.ENTRY_CHUNK = 0] = "ENTRY_CHUNK", e4[e4.SECONDARY_CHUNK = 1] = "SECONDARY_CHUNK", e4[e4.ASSET = 2] = "ASSET";
}(nd || (nd = {}));
const shimSourceURL = new URL("http://localhost:4175/0.0.2/assets/_preview2-shim-DNYff_t_.js", import.meta.url);
async function load(wasmBytes, importables = []) {
  let code = await generateCode(wasmBytes, importables);
  let dataUrl = `data:application/javascript,${encodeURIComponent(code)}`;
  let mod2 = await import(
    /* @vite-ignore */
    dataUrl
  );
  return mod2;
}
async function generateCode(wasmBytes, importables = []) {
  const shimSource = await fetch(shimSourceURL).then((r2) => r2.text());
  let shimName = "./shim.js";
  let name = "component";
  importables = importables.reduce(
    (acc, current) => {
      let name2 = Object.keys(current)[0];
      let code2 = current[name2];
      let globImportPattern = /\/\*$/;
      let filePath = "./" + name2.replace(globImportPattern, "").replace(":", "_").replace(/\//g, "_") + ".js";
      acc[0][name2] = filePath + (name2.match(globImportPattern) ? "#*" : "");
      acc[1].push([filePath, code2]);
      return acc;
    },
    [{}, []]
  );
  let map = Object.assign(
    {
      // Using bundled shim is faster (but bigger: 3.5MB) than CDN https://unpkg.com/@bytecodealliance/preview2-shim/lib/browser/index.js
      "wasi:cli/*": `${shimName}#*`,
      "wasi:filesystem/*": `${shimName}#*`,
      "wasi:io/*": `${shimName}#*`,
      "wasi:sockets/*": `${shimName}#*`,
      "wasi:random/*": `${shimName}#*`,
      "wasi:clocks/*": `${shimName}#*`
    },
    {
      // specify location of imported functions, if applicable
      ...importables[0]
    }
  );
  let opts = {
    name,
    map: Object.entries(map ?? {}),
    validLiftingOptimization: false,
    noNodejsCompat: true,
    tlaCompat: false,
    base64Cutoff: 4096
  };
  let { files, imports, exports } = await transpile(wasmBytes, opts);
  let code = await Zu({
    input: name + ".js",
    plugins: [plugin([...files, ...importables[1], [shimName, shimSource]])]
  }).then((bundle) => bundle.generate({ format: "es" })).then(({ output }) => output[0].code);
  return code;
}
let mod;
addEventListener("message", async (e4) => {
  var _a3, _b, _c2, _d;
  const { action, payload, messageId } = e4.data;
  let rendered;
  switch (action) {
    case "load":
      try {
        mod = await load(payload.arrayBuffer, payload.importables);
        if ((payload == null ? void 0 : payload.templates) && (payload == null ? void 0 : payload.templates.length) > 0) {
          mod.wurboOut.customize(payload.templates);
        }
      } catch (e5) {
        console.error("Error loading", e5);
      }
      break;
    case "render":
      let i2 = 0;
      while (!(mod && (mod == null ? void 0 : mod.wurboOut) && ((_a3 = mod == null ? void 0 : mod.wurboOut) == null ? void 0 : _a3.render))) {
        if (i2 > 10) {
          console.warn("Condition not met");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        i2++;
      }
      try {
        rendered = await mod.wurboOut.render(payload);
      } catch (e5) {
        console.warn("Cannot render: ", e5);
        break;
      }
      break;
    case "activate":
      let j2 = 0;
      while (!(mod && (mod == null ? void 0 : mod.wurboOut) && ((_b = mod == null ? void 0 : mod.wurboOut) == null ? void 0 : _b.activate))) {
        if (j2 > 10) {
          console.warn("Condition not met");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        j2++;
      }
      try {
        mod.wurboOut.activate(payload);
      } catch (e5) {
        console.warn("No activate function for module.");
        break;
      }
      break;
    case "aggregation":
      let k2 = 0;
      while (!(mod && (mod == null ? void 0 : mod.aggregation) && ((_c2 = mod == null ? void 0 : mod.aggregation) == null ? void 0 : _c2.activates))) {
        if (k2 > 10) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        k2++;
      }
      try {
        (_d = mod == null ? void 0 : mod.aggregation) == null ? void 0 : _d.activates(payload);
      } catch (e5) {
        console.warn("No aggregation.activates function for module: ", mod);
        break;
      }
      break;
  }
  postMessage({ action, payload: rendered, messageId });
});
