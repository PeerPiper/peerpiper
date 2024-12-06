use tokio::io::AsyncReadExt as _;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    window, Blob, FileSystemDirectoryHandle, FileSystemFileHandle, FileSystemGetFileOptions,
    FileSystemWritableFileStream,
};

use bytes::Bytes;
use wnfs::common::blockstore::BlockStore;
use wnfs::common::libipld::Cid;
use wnfs::common::utils::CondSend;
use wnfs::common::BlockStoreError;

pub use peerpiper_core::SystemCommandHandler;
use wnfs_unixfs_file::builder::FileBuilder;
use wnfs_unixfs_file::unixfs::UnixFsFile;

use crate::error::Error;

/// Uses Origin Privacy File System (OPFS) to store blocks
pub struct OPFSBlockstore {
    inner: FileSystemDirectoryHandle,
}

impl OPFSBlockstore {
    /// Create a new OPFSBlockstore
    pub async fn new() -> Result<Self, JsValue> {
        let window = window().ok_or_else(|| JsValue::from_str("No window available"))?;
        let navigator = window.navigator();
        let storage = navigator.storage();

        let directory_handle: FileSystemDirectoryHandle =
            JsFuture::from(storage.get_directory()).await?.into();

        Ok(Self {
            inner: directory_handle,
        })
    }

    /// Put block bytes into the OPFS under the given name
    pub async fn put_opfs(&self, name: &str, data: Vec<u8>) -> Result<(), JsValue> {
        let options = FileSystemGetFileOptions::new();
        options.set_create(true);

        let file_handle: FileSystemFileHandle =
            JsFuture::from(self.inner.get_file_handle_with_options(name, &options))
                .await?
                .into();

        let writable: FileSystemWritableFileStream =
            JsFuture::from(file_handle.create_writable()).await?.into();

        JsFuture::from(writable.write_with_u8_array(&data)?).await?;

        JsFuture::from(writable.close()).await?;

        Ok(())
    }

    /// Get block bytes from the OPFS by name
    pub async fn get_opfs(&self, name: &str) -> Result<Vec<u8>, JsValue> {
        let file_handle_result = JsFuture::from(self.inner.get_file_handle(name)).await;

        match file_handle_result {
            Ok(handle) => {
                let file_handle: FileSystemFileHandle = handle.into();

                let file: Blob = JsFuture::from(file_handle.get_file()).await?.into();
                let array_bufer = JsFuture::from(file.array_buffer()).await?;
                let u8_array = js_sys::Uint8Array::new(&array_bufer);

                Ok(u8_array.to_vec())
            }
            Err(_) => Err(JsValue::from_str("File not found")),
        }
    }
}

impl BlockStore for OPFSBlockstore {
    async fn get_block(&self, cid: &Cid) -> Result<Bytes, BlockStoreError> {
        let js_uint8array = self
            .get_opfs(cid.to_string().as_str())
            .await
            .map_err(|_| BlockStoreError::CIDNotFound(*cid))?;
        let bytes: Bytes = js_uint8array.into();
        Ok(bytes)
    }

    async fn put_block_keyed(
        &self,
        cid: Cid,
        bytes: impl Into<Bytes> + CondSend,
    ) -> Result<(), BlockStoreError> {
        let bytes: Bytes = bytes.into();

        self.put_opfs(cid.to_string().as_str(), bytes.to_vec())
            .await
            .map_err(|_| BlockStoreError::CIDNotFound(cid))?;

        Ok(())
    }

    async fn has_block(&self, cid: &Cid) -> Result<bool, BlockStoreError> {
        Ok(self.get_opfs(cid.to_string().as_str()).await.is_ok())
    }
}

impl SystemCommandHandler for OPFSBlockstore {
    type Error = crate::error::Error;

    async fn put(&self, data: Vec<u8>) -> Result<Cid, Self::Error> {
        let root_cid = put_chunks(self, data).await.map_err(|err| {
            crate::error::Error::String(format!("Failed to put bytes in the system: {}", err))
        })?;

        Ok(root_cid)
    }

    async fn get(&self, key: Vec<u8>) -> Result<Vec<u8>, Self::Error> {
        // TODO: should be chunked to interop with other file systems?
        let cid = Cid::try_from(key)?;
        // because we chunked the data going in, we need to read it coming out
        let file = UnixFsFile::load(&cid, &self).await?;

        let mut buffer = Vec::new();
        let mut reader = file.into_content_reader(&self, None)?;
        reader.read_to_end(&mut buffer).await?;

        Ok(buffer)
    }
}

/// A Chunker that takes bytes and chunks them
pub async fn put_chunks<B: BlockStore + Clone>(blockstore: B, data: Vec<u8>) -> Result<Cid, Error> {
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

    fn is_system_command_handler<T: SystemCommandHandler>() {}

    #[test]
    fn test_traits() {
        is_system_command_handler::<OPFSBlockstore>();
    }
}
