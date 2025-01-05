//! The native platform impl of [blockstore::Blockstore]
use std::path::PathBuf;

//use bytes::Bytes;
//use tokio::io::AsyncReadExt as _;
//use wnfs_unixfs_file::builder::FileBuilder;
//use wnfs_unixfs_file::unixfs::UnixFsFile;

use super::Blockstore;

use crate::NativeError;

/// Blockstore saved to disk. See [NativeBlockstore]
pub struct NativeBlockstoreBuilder {
    directory: PathBuf,
}

/// Blockstore saved to disk.
///
/// # Example
/// ```rust
/// use peerpiper_native::NativeBlockstoreBuilder;
/// use peerpiper_core::Cid;
/// use std::path::PathBuf;
/// use tempfile::tempdir;
///
///  // import the necessary traits
/// use peerpiper_core::Blockstore as _;
/// use peerpiper_core::{Block, RawBlakeBlock};
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///    let tempdir = tempdir()?.path().to_path_buf(); // testing only, feel free to use your own path, or the default
///    let blockstore = NativeBlockstoreBuilder::new(tempdir).open().await.unwrap();
///    let data = b"hello world".to_vec();
///    let block = RawBlakeBlock(data.clone());
///    let cid = block.cid().unwrap();
///    blockstore.put(block).await.unwrap();
///    let retrieved_data = blockstore.get(&cid).await.unwrap();
///    assert_eq!(data, retrieved_data.unwrap());
///    Ok(())
/// }
/// ```
#[derive(Clone, Debug)]
pub struct NativeBlockstore {
    directory: PathBuf,
}

impl Default for NativeBlockstoreBuilder {
    fn default() -> Self {
        // use dir to save the Blockstore data in user's local data directory
        let directory = dirs::data_local_dir()
            .ok_or(NativeError::NoDataDir)
            .unwrap_or_default()
            .join("peerpiper")
            .join("blockstore");

        Self { directory }
    }
}

impl NativeBlockstoreBuilder {
    /// Create a new NativeBlockstore
    pub fn new(directory: PathBuf) -> Self {
        Self { directory }
    }

    /// Asserts that the directory exists, if not, creates it
    pub async fn open(self) -> Result<NativeBlockstore, NativeError> {
        std::fs::create_dir_all(&self.directory).map_err(NativeError::Io)?;
        Ok(NativeBlockstore {
            directory: self.directory,
        })
    }
}

impl Blockstore for NativeBlockstore {
    async fn get<const S: usize>(
        &self,
        cid: &cid::CidGeneric<S>,
    ) -> blockstore::Result<Option<Vec<u8>>> {
        let path = self.directory.join(cid.to_string());

        if !path.exists() {
            return Ok(None);
        }

        let bytes =
            std::fs::read(&path).map_err(|e| blockstore::Error::StoredDataError(e.to_string()))?;

        Ok(Some(bytes))
    }

    async fn put_keyed<const S: usize>(
        &self,
        cid: &cid::CidGeneric<S>,
        data: &[u8],
    ) -> blockstore::Result<()> {
        let path = self.directory.join(cid.to_string());

        std::fs::write(&path, data)
            .map_err(|e| blockstore::Error::StoredDataError(e.to_string()))?;

        Ok(())
    }

    async fn remove<const S: usize>(&self, cid: &cid::CidGeneric<S>) -> blockstore::Result<()> {
        let path = self.directory.join(cid.to_string());

        std::fs::remove_file(&path)
            .map_err(|e| blockstore::Error::StoredDataError(e.to_string()))?;

        Ok(())
    }

    async fn close(self) -> blockstore::Result<()> {
        Ok(())
    }
}

///// A Chunker that takes bytes and chunks them
//pub async fn put_chunks<B: Blockstore + Clone>(
//    blockstore: B,
//    data: Vec<u8>,
//) -> Result<Cid, NativeError> {
//    let root_cid = FileBuilder::new()
//        .content_bytes(data.clone())
//        .fixed_chunker(256 * 1024)
//        .build()?
//        .store(&blockstore)
//        .await?;
//
//    Ok(root_cid)
//}

#[cfg(test)]
mod tests {
    use super::*;
    use peerpiper_core::{Block, Blockstore as _, RawBlakeBlock};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_native_blockstore() {
        let tempdir = tempdir().unwrap().path().to_path_buf();
        let blockstore = NativeBlockstoreBuilder::new(tempdir).open().await.unwrap();

        let data = b"hello world".to_vec();

        let block = RawBlakeBlock(data.clone());
        let cid = block.cid().unwrap();

        blockstore.put(block).await.unwrap();
        let retrieved_data = blockstore.get(&cid).await.unwrap();

        assert_eq!(data, retrieved_data.unwrap());
    }

    #[tokio::test]
    async fn test_put_large_bytes() {
        let tempdir = tempdir().unwrap().path().to_path_buf();
        let blockstore = NativeBlockstoreBuilder::new(tempdir).open().await.unwrap();

        let len = 1 << 19; // 512KB, 2^19 bytes
        let data = vec![42; len];

        let block = RawBlakeBlock(data.clone());
        let root_cid = block.cid().unwrap();

        blockstore.put(block).await.unwrap();

        let retrieved_data = blockstore.get(&root_cid).await.unwrap();

        assert_eq!(data, retrieved_data.unwrap());
    }
}
