use cid::Cid;
use multihash_codetable::{Code, MultihashDigest};
pub use peerpiper_core::events::PeerPiperCommand;
use wasm_bindgen_test::wasm_bindgen_test_configure;
use wasm_bindgen_test::*;

wasm_bindgen_test_configure!(run_in_browser);

const RAW: u64 = 0x55;

#[wasm_bindgen_test]
fn pass() {
    assert_eq!(1, 1);
}

#[wasm_bindgen_test]
async fn idb_test() {
    // try to create idb and save somthing
    let blockstore = peerpiper_browser::blockstore_idb::IDBBlockstore::new("peerpiper");
    let _ = wasm_bindgen_futures::JsFuture::from(blockstore.open()).await;

    // create a block of data, get the CID, and put it into store
    let bytes = vec![0, 1, 2, 3];
    // let version = 1;
    // let codec = 0x71; // 0x71 is raw
    // let multihash = 0x12; // 0x12 is sha2-256
    let h = Code::Sha2_256.digest(bytes.as_slice());
    let cid = Cid::new_v1(RAW, h);

    let key = peerpiper_browser::blockstore_idb::CID::parse(&cid.to_string());

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
