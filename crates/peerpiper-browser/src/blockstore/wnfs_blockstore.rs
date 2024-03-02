use bytes::Bytes;
use wnfs::common::libipld::Cid;
use wnfs::common::utils::CondSend;
use wnfs::common::BlockStore as WNFSBlockStore;
use wnfs::common::BlockStoreError;
// use wnfs::common::Storable;
use wnfs_unixfs_file::builder::FileBuilder;

use super::BrowserBlockStore;
use super::CID;

impl WNFSBlockStore for BrowserBlockStore {
    async fn get_block(&self, cid: &Cid) -> Result<Bytes, BlockStoreError> {
        let key = CID::parse(&cid.to_string());
        let js_uint8array = self
            .get_idb(&key)
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
        let _cid = self.put_idb(&key, val).await;

        Ok(())
    }

    async fn has_block(&self, cid: &Cid) -> Result<bool, BlockStoreError> {
        let key = CID::parse(&cid.to_string());
        Ok(self
            .has_in_idb(&key)
            .await
            .map_err(|_| BlockStoreError::CIDNotFound(*cid))?)
    }
}

/// A Chunker that takes bytes and chunks them
pub async fn put_chunks<B: WNFSBlockStore + Clone>(
    blockstore: B,
    data: Vec<u8>,
) -> Result<Cid, anyhow::Error> {
    let root_cid = FileBuilder::new()
        .content_bytes(data.clone())
        .fixed_chunker(256 * 1024)
        .build()?
        .store(&blockstore.clone())
        .await?;

    Ok(root_cid)
}
