pub use peerpiper_core::events::PeerPiperCommand;
use wasm_bindgen::{JsError, JsValue};
use wasm_bindgen_test::console_log;
use wasm_bindgen_test::wasm_bindgen_test_configure;
use wasm_bindgen_test::*;

wasm_bindgen_test_configure!(run_in_browser);

const RAW: u64 = 0x55;

#[wasm_bindgen_test]
async fn idb_test() {
    use cid::Cid;
    use multihash_codetable::{Code, MultihashDigest, Sha2_256};

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
    use wnfs::common::blockstore::BlockStore as WNFSBlockStore;
    use wnfs::common::libipld::cid::{Cid, CidGeneric};
    use wnfs::common::CODEC_RAW;

    // async fn get_block(&self, cid: &Cid) -> Result<Bytes, BlockStoreError>
    // async fn put_block_keyed(&self, cid: Cid, bytes: impl Into<Bytes> + CondSend) -> Result<(), BlockStoreError>
    // async fn has_block(&self, cid: &Cid) -> Result<bool, BlockStoreError> {
    let blockstore =
        peerpiper_browser::bindgen::blockstore_idb::BrowserBlockStore::new("peerpiper");
    let _ = blockstore.open().await;

    let bytes = vec![42; 1024 * 256]; // 256 ok, 286 nope.
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

#[wasm_bindgen_test]
async fn test_chunker() -> Result<(), JsValue> {
    use rand_chacha::ChaCha12Rng;
    use rand_core::{RngCore, SeedableRng};
    use tokio::io::AsyncReadExt;
    use wnfs_unixfs_file::builder::FileBuilder;
    use wnfs_unixfs_file::unixfs::UnixFsFile;

    let blockstore =
        peerpiper_browser::bindgen::blockstore_idb::BrowserBlockStore::new("peerpiper");
    let _ = blockstore.open().await;

    let len = 1024 * 1024;
    // create a random seed
    let seed: u64 = rand::random();
    let rng = &mut ChaCha12Rng::seed_from_u64(seed);
    let mut data = vec![0; len];
    rng.fill_bytes(&mut data);

    let root_cid = FileBuilder::new()
        .content_bytes(data.clone())
        .fixed_chunker(256 * 1024)
        .build()
        .map_err(|err| JsError::new(&format!("Failed to build file: {}", err)))?
        .store(&blockstore.clone())
        .await
        .map_err(|err| JsError::new(&format!("Failed to store file: {}", err)))?;

    let file = UnixFsFile::load(&root_cid, &blockstore)
        .await
        .map_err(|err| {
            JsError::new(&format!(
                "Failed to load file from blockstore: {}",
                err.to_string()
            ))
        })?;
    assert_eq!(file.filesize(), Some(len as u64));

    let mut buffer = Vec::new();
    let mut reader = file
        .into_content_reader(&blockstore, None)
        .map_err(|err| JsError::new(&format!("Failed to create content reader: {}", err)))?;
    reader
        .read_to_end(&mut buffer)
        .await
        .map_err(|err| JsError::new(&format!("Failed to read file: {}", err)))?;

    assert_eq!(buffer, data);

    Ok(())
}