//#![cfg(target_arch = "wasm32")] // <== So that peerpiper_browser::bindgen references are valid

use cid::Cid;
use peerpiper_browser::opfs::OPFSBlockstore;
pub use peerpiper_core::events::AllCommands;
use wasm_bindgen::{JsError, JsValue};
use wasm_bindgen_test::wasm_bindgen_test_configure;
use wasm_bindgen_test::*;

wasm_bindgen_test_configure!(run_in_browser);

const RAW: u64 = 0x55;

#[wasm_bindgen_test]
fn test_traits() {
    use peerpiper_browser::SystemCommandHandler;

    fn is_system_command_handler<T: SystemCommandHandler>() {}

    is_system_command_handler::<OPFSBlockstore>();
}

#[wasm_bindgen_test]
async fn idb_test() {
    use cid::Cid;
    use multihash_codetable::{Code, MultihashDigest};

    // try to create idb and save somthing
    let blockstore = peerpiper_browser::blockstore::IDBBlockstore::new("peerpiper");
    let _ = wasm_bindgen_futures::JsFuture::from(blockstore.open()).await;

    // create a block of data, get the CID, and put it into store
    let bytes = vec![0, 1, 2, 3];
    // let version = 1;
    // let codec = 0x71; // 0x71 is raw
    // let multihash = 0x12; // 0x12 is sha2-256
    let h = Code::Sha2_256.digest(bytes.as_slice());
    let cid = Cid::new_v1(RAW, h);

    let key = peerpiper_browser::blockstore::CID::parse(&cid.to_string());

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
    use wnfs::common::CODEC_RAW;

    // async fn get_block(&self, cid: &Cid) -> Result<Bytes, BlockStoreError>
    // async fn put_block_keyed(&self, cid: Cid, bytes: impl Into<Bytes> + CondSend) -> Result<(), BlockStoreError>
    // async fn has_block(&self, cid: &Cid) -> Result<bool, BlockStoreError> {
    let blockstore = peerpiper_browser::blockstore::BrowserBlockStore::new("peerpiper");
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

    let blockstore = peerpiper_browser::blockstore::BrowserBlockStore::new("peerpiper");
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

#[wasm_bindgen_test]
async fn test_commander() -> Result<(), JsValue> {
    // we need to create a new PeerPiper struct before we begen
    let peerpiper = peerpiper_browser::bindgen::PeerPiper::new("peerpiper".to_string())
        .await
        .map_err(|err| JsError::new(&format!("Failed to create PeerPiper: {:?}", err)))?;

    let len = 1024 * 1024;

    let bytes = vec![24; len];

    // call crate::bindgen::command with Stringified AllCommands::SystemCommands for put, then get, compare the
    // two to ensure they match.
    let command = AllCommands::System(peerpiper_core::events::SystemCommand::Put {
        bytes: bytes.clone(),
    });

    let js_cmd = serde_wasm_bindgen::to_value(&command).map_err(|err| {
        JsError::new(&format!(
            "Failed to serialize AllCommands::SystemCommands: {:?}",
            err.to_string()
        ))
    })?;

    let cid = peerpiper.command(js_cmd).await?;

    let cid: Cid = serde_wasm_bindgen::from_value(cid)?;

    // now get the data back from cid string
    let command =
        AllCommands::System(peerpiper_core::events::SystemCommand::Get { key: cid.into() });

    let json = serde_wasm_bindgen::to_value(&command).map_err(|e| {
        JsError::new(&format!(
            "Failed to serialize AllCommands::SystemCommands: {:?}",
            e.to_string()
        ))
    })?;

    let data = peerpiper.command(json).await?;

    // data should be a JsValue that converts to bytes vector which matches the original bytes
    let data: Vec<u8> = serde_wasm_bindgen::from_value(data)?;

    assert_eq!(data, bytes);

    Ok(())
}

#[wasm_bindgen_test]
async fn test_opfs_blockstore() {
    let blockstore = OPFSBlockstore::new().await.unwrap();
    let name = "hello.bin";
    let bytes = b"Hello World".to_vec();
    blockstore.put_opfs(name, bytes.clone()).await.unwrap();
    let data = blockstore.get_opfs(name).await.unwrap();
    assert_eq!(data, bytes);
}

#[wasm_bindgen_test]
async fn test_wnfs_impl_opfs() {
    use bytes::Bytes;
    use wnfs::common::blockstore::BlockStore as WNFSBlockStore;
    use wnfs::common::CODEC_RAW;

    let blockstore = peerpiper_browser::opfs::OPFSBlockstore::new()
        .await
        .unwrap();

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

// test 512kb into OPFS using put/get
// 2^18 is the max size for a single chunk
#[wasm_bindgen_test]
async fn test_opfs_put_get() {
    let blockstore = OPFSBlockstore::new().await.unwrap();
    let name = "hello.bin";
    let len = 1 << 19; // 512kb, 2^19
    let bytes = vec![42; len];
    blockstore.put_opfs(name, bytes.clone()).await.unwrap();
    let data = blockstore.get_opfs(name).await.unwrap();
    assert_eq!(data, bytes);
}

#[wasm_bindgen_test]
async fn test_opfs_system_command_handler() -> Result<(), JsValue> {
    use peerpiper_core::SystemCommandHandler as _;

    let blockstore = OPFSBlockstore::new()
        .await
        .map_err(|err| JsError::new(&format!("Failed to create OPFSBlockstore: {:?}", err)))?;

    let len = 1 << 19; // 512kb, 2^19
    let bytes = vec![42; len];

    let root_cid = blockstore
        .put(bytes.clone())
        .await
        .map_err(|err| JsError::new(&format!("Failed to put bytes in the system: {:?}", err)))?;

    let data = blockstore
        .get(root_cid.to_bytes())
        .await
        .map_err(|err| JsError::new(&format!("Failed to get bytes from the system: {:?}", err)))?;

    assert_eq!(data, bytes);

    Ok(())
}

// test creating a OPFSBlockstore in a wasm_bindgen_futures spawn_local
#[wasm_bindgen_test]
async fn test_spawn_local() {
    use crossbeam_channel::{unbounded, Receiver, Sender};

    use futures::channel::oneshot;
    use wasm_bindgen_futures::{spawn_local, JsFuture};

    let (sender, receiver) = oneshot::channel();

    spawn_local(async move {
        let blockstore = OPFSBlockstore::new().await.unwrap();
        sender.send(blockstore).unwrap();
    });

    let blockstore = receiver.await.unwrap();

    //let name = "hello.bin";
    //let bytes = b"Hello World".to_vec();
    //blockstore.put_opfs(name, bytes.clone()).await.unwrap();
    //let data = blockstore.get_opfs(name).await.unwrap();
    //assert_eq!(data, bytes);
}
