use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(module = "/src/blockstore-idb.js")]
extern "C" {

    /// CID Class
    pub type CID;

    /// CID Constructor
    #[wasm_bindgen(constructor)]
    pub fn new(version: u64, codec: u64, multihash: &Uint8Array, bytes: &Uint8Array) -> CID;

    /// static parse(string)
    /// Parse a CID from a string
    #[wasm_bindgen(static_method_of = CID)]
    pub fn parse(string: &str) -> CID;

    /// CID method toString()
    #[wasm_bindgen(method, js_name = toString)]
    pub fn to_string(this: &CID) -> String;

    pub type IDBBlockstore;

    #[wasm_bindgen(constructor)]
    pub fn new(location: &str) -> IDBBlockstore;

    /// Open method, open(): Promise<void>
    #[wasm_bindgen(method)]
    pub fn open(this: &IDBBlockstore) -> js_sys::Promise;

    /// close(): Promise<void>
    #[wasm_bindgen(method)]
    pub fn close(this: &IDBBlockstore) -> js_sys::Promise;

    /// delete(key): Promise<void>
    #[wasm_bindgen(method)]
    pub fn delete(this: &IDBBlockstore, key: &str) -> js_sys::Promise;

    /// deleteMany(source, options?): AwaitIterable<CID<unknown, number, number, Version>>
    #[wasm_bindgen(method)]
    pub fn delete_many(this: &IDBBlockstore, source: &JsValue) -> js_sys::Promise;

    /// destroy(): Promise<void>
    #[wasm_bindgen(method)]
    pub fn destroy(this: &IDBBlockstore) -> js_sys::Promise;

    /// get(key): Promise<Uint8Array>
    #[wasm_bindgen(method)]
    pub fn get(this: &IDBBlockstore, key: &CID) -> js_sys::Promise;

    /// getAll(options?): AwaitIterable<Pair>
    #[wasm_bindgen(method)]
    pub fn get_all(this: &IDBBlockstore) -> js_sys::Promise;

    /// getMany(source, options?): AwaitIterable<Pair>
    /// Retrieve values for the passed keys
    ///
    /// Parameters
    /// source: AwaitIterable<CID<unknown, number, number, Version>>
    /// Optional options: AbortOptions
    /// Returns AwaitIterable<Pair>
    #[wasm_bindgen(method)]
    pub fn get_many(this: &IDBBlockstore, source: &JsValue) -> js_sys::Promise;

    /// has(key): Promise<boolean>
    #[wasm_bindgen(method)]
    pub fn has(this: &IDBBlockstore, key: &str) -> js_sys::Promise;

    /// put(key, val: Uint8Array): Promise<CID<unknown, number, number, Version>>
    #[wasm_bindgen(method)]
    pub fn put(this: &IDBBlockstore, key: &CID, val: Uint8Array) -> js_sys::Promise;

    /// putMany(source, options?): AwaitIterable<CID<unknown, number, number, Version>>
    #[wasm_bindgen(method)]
    pub fn put_many(this: &IDBBlockstore, source: &JsValue) -> js_sys::Promise;

}
