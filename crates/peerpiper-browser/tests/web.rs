use multihash_codetable::{Code, MultihashDigest};
pub use peerpiper_core::events::PeerPiperCommand;
use wasm_bindgen_test::wasm_bindgen_test_configure;
use wasm_bindgen_test::*;

wasm_bindgen_test_configure!(run_in_browser);

const RAW: u64 = 0x55;

#[wasm_bindgen_test]
async fn idb_test() {
    use cid::Cid;

    // try to create idb and save somthing
    let blockstore = peerpiper_browser::bindgen::blockstore_idb::IDBBlockstore::new("peerpiper");
    let _ = wasm_bindgen_futures::JsFuture::from(blockstore.open()).await;

    // create a block of data, get the CID, and put it into store
    let bytes = vec![0, 1, 2, 3];
    // let version = 1;
    // let codec = 0x71; // 0x71 is raw
    // let multihash = 0x12; // 0x12 is sha2-256
    let h = Code::Sha2_256.digest(bytes.as_slice());
    let cid = Cid::new_v1(RAW, h);

    let key = peerpiper_browser::bindgen::blockstore_idb::CID::parse(&cid.to_string());

    let val = js_sys::Uint8Array::from(bytes.as_slice());
    let cid = blockstore.put(&key, val);
    wasm_bindgen_futures::JsFuture::from(cid)
        .await
        .expect("test to pass");

    // get it from the store, check that it's the same
    let data = blockstore.get(&key);
    let js_val = wasm_bindgen_futures::JsFuture::from(data)
        .await
        .expect("tests should pass");

    // into Rust Vec<u8>
    let js_val: js_sys::Uint8Array = js_val.into();
    let mut buf = vec![0; js_val.length() as usize];
    js_val.copy_to(&mut buf);
    assert_eq!(buf, bytes);
}

#[wasm_bindgen_test]
async fn test_wnfs_impl() {
    use bytes::Bytes;
    use wnfs::common::blockstore::BlockStore;
    use wnfs::common::libipld::cid::{Cid, CidGeneric};
    use wnfs::common::CODEC_RAW;

    // async fn get_block(&self, cid: &Cid) -> Result<Bytes, BlockStoreError>
    // async fn put_block_keyed(&self, cid: Cid, bytes: impl Into<Bytes> + CondSend) -> Result<(), BlockStoreError>
    // async fn has_block(&self, cid: &Cid) -> Result<bool, BlockStoreError> {
    let blockstore =
        peerpiper_browser::bindgen::blockstore_idb::BrowserBlockStore::new("peerpiper");
    let _ = blockstore.open().await;

    let bytes = vec![69, 42, 42, 69];
    let bytes: Bytes = bytes.into();
    let cid = blockstore
        .put_block(bytes.clone(), CODEC_RAW)
        .await
        .expect("test should be able to put a block");

    let has_block = blockstore
        .has_block(&cid)
        .await
        .expect("test should be able to check for block");

    assert_eq!(has_block, true);

    let block = blockstore
        .get_block(&cid.into())
        .await
        .expect("test should be able to get a block");

    assert_eq!(block, bytes);
}
