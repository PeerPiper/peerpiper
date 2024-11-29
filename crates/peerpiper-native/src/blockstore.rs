//! The native platform impl of wnfs::Blockstore
use std::path::PathBuf;

use bytes::Bytes;
use peerpiper_core::{
    wnfs_common::{blockstore::BlockStore, libipld::Cid, utils::CondSend, BlockStoreError},
    SystemCommandHandler,
};
use tokio::io::AsyncReadExt as _;
use wnfs_unixfs_file::builder::FileBuilder;
use wnfs_unixfs_file::unixfs::UnixFsFile;

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
/// use peerpiper_core::{BlockStoreError, Cid};
/// use std::path::PathBuf;
/// use tempfile::tempdir;
///
///  // import the necessary traits
/// use peerpiper_core::BlockStore as _;
/// use peerpiper_core::SystemCommandHandler as _;
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///    let tempdir = tempdir()?.path().to_path_buf(); // testing only, feel free to use your own path, or the default
///    let blockstore = NativeBlockstoreBuilder::new(tempdir).open().await.unwrap();
///    let data = b"hello world".to_vec();
///    let cid: Cid = blockstore.put(data.clone()).await.unwrap();
///    let retrieved_data = blockstore.get(cid.to_bytes()).await.unwrap();
///    assert_eq!(data, retrieved_data);
///    Ok(())
/// }
/// ```
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

impl BlockStore for NativeBlockstore {
    async fn get_block(&self, cid: &Cid) -> Result<Bytes, BlockStoreError> {
        let path = self.directory.join(cid.to_string());

        let bytes =
            std::fs::read(&path).map_err(|e| BlockStoreError::Custom(anyhow::Error::new(e)))?;

        Ok(Bytes::from(bytes))
    }

    async fn put_block_keyed(
        &self,
        cid: Cid,
        bytes: impl Into<Bytes> + CondSend,
    ) -> Result<(), BlockStoreError> {
        let bytes: Bytes = bytes.into();

        let path = self.directory.join(cid.to_string());

        std::fs::write(&path, bytes).map_err(|e| BlockStoreError::Custom(anyhow::Error::new(e)))?;

        Ok(())
    }

    async fn has_block(&self, cid: &Cid) -> Result<bool, BlockStoreError> {
        let path = self.directory.join(cid.to_string());

        Ok(path.exists())
    }
}

impl SystemCommandHandler for NativeBlockstore {
    type Error = crate::error::NativeError;

    async fn put(&self, data: Vec<u8>) -> Result<Cid, Self::Error> {
        let root_cid = put_chunks(self, data).await?;
        Ok(root_cid)
    }

    async fn get(&self, key: Vec<u8>) -> Result<Vec<u8>, Self::Error> {
        let cid = Cid::try_from(key)?;
        let file = UnixFsFile::load(&cid, &self).await?;

        let mut buffer = Vec::new();
        let mut reader = file.into_content_reader(&self, None)?;
        reader.read_to_end(&mut buffer).await?;

        Ok(buffer)
    }
}

/// A Chunker that takes bytes and chunks them
pub async fn put_chunks<B: BlockStore + Clone>(
    blockstore: B,
    data: Vec<u8>,
) -> Result<Cid, NativeError> {
    let root_cid = FileBuilder::new()
        .content_bytes(data.clone())
        .fixed_chunker(256 * 1024)
        .build()?
        .store(&blockstore)
        .await?;

    Ok(root_cid)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_native_blockstore() {
        let tempdir = tempdir().unwrap().path().to_path_buf();
        let blockstore = NativeBlockstoreBuilder::new(tempdir).open().await.unwrap();

        let data = b"hello world".to_vec();

        let cid = blockstore.put(data.clone()).await.unwrap();
        let retrieved_data = blockstore.get(cid.to_bytes()).await.unwrap();

        assert_eq!(data, retrieved_data);
    }

    #[tokio::test]
    async fn test_put_large_bytes() {
        let tempdir = tempdir().unwrap().path().to_path_buf();
        let blockstore = NativeBlockstoreBuilder::new(tempdir).open().await.unwrap();

        let len = 1 << 19; // 512KB, 2^19 bytes
        let data = vec![42; len];

        let root_cid = blockstore.put(data.clone()).await.unwrap();

        let retrieved_data = blockstore.get(root_cid.to_bytes()).await.unwrap();

        assert_eq!(data, retrieved_data);
    }
}
