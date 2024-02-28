use bytes::Bytes;
use js_sys::Uint8Array;
use parking_lot::Mutex;
use send_wrapper::SendWrapper;
use wasm_bindgen::prelude::*;
use wnfs::common::libipld::Cid;
use wnfs::common::utils::Arc;
use wnfs::common::utils::CondSend;
use wnfs::common::BlockStore;
use wnfs::common::BlockStoreError;

#[wasm_bindgen(module = "/src/bindgen/blockstore-idb.js")]
extern "C" {

    /// CID Class
    pub(crate) type CID;

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

    #[derive(Debug)]
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

#[derive(Debug, Clone)]
pub struct BrowserBlockStore {
    pub(crate) idb: SendWrapper<Arc<Mutex<IDBBlockstore>>>,
}

impl BrowserBlockStore {
    /// Creates a new in-memory block store.
    pub fn new(namespace: &str) -> Self {
        let blockstore = IDBBlockstore::new(namespace);
        Self {
            idb: SendWrapper::new(Arc::new(Mutex::new(blockstore))),
        }
    }

    /// Opens the blockstore.
    pub async fn open(&self) -> Result<(), JsValue> {
        let promise = self.idb.lock().open();
        let _ = wasm_bindgen_futures::JsFuture::from(promise)
            .await
            .map_err(|_| JsValue::from_str("Error opening blockstore"));
        Ok(())
    }

    pub async fn get(&self, cid: &CID) -> Result<Uint8Array, JsValue> {
        let promise = self.idb.lock().get(cid);
        let js_val = wasm_bindgen_futures::JsFuture::from(promise)
            .await
            .map_err(|_| JsValue::from_str("Error getting block"))?;
        Ok(js_val.into())
    }
}

impl BlockStore for BrowserBlockStore {
    async fn get_block(&self, cid: &Cid) -> Result<Bytes, BlockStoreError> {
        let key = CID::parse(&cid.to_string());
        let js_uint8array = self
            .get(&key)
            .await
            .map_err(|_| BlockStoreError::CIDNotFound(*cid))?;
        let bytes: Bytes = js_uint8array.to_vec().into();
        Ok(bytes)
    }

    async fn put_block_keyed(
        &self,
        cid: Cid,
        bytes: impl Into<Bytes> + CondSend,
    ) -> Result<(), BlockStoreError> {
        let key = CID::parse(&cid.to_string());

        let bytes: Bytes = bytes.into();

        let val = js_sys::Uint8Array::from(bytes.as_ref());
        // call put inside the send_wrapper
        let _cid = self.idb.lock().put(&key, val);

        Ok(())
    }

    async fn has_block(&self, cid: &Cid) -> Result<bool, BlockStoreError> {
        let key = CID::parse(&cid.to_string());
        let js_val = self.idb.lock().has(&key.to_string());
        let js_val = wasm_bindgen_futures::JsFuture::from(js_val)
            .await
            .map_err(|_| BlockStoreError::CIDNotFound(*cid))?;
        Ok(js_val.as_bool().unwrap())
    }
}
