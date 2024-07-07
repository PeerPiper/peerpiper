//! Wasm-Bindgen bindings for the PeerPiper Wallet. This crate essentially does the conversion
//! to/from JsValue for the main module.
use delano_wallet_core::IssueOptions;
use delanocreds::{Attribute, MaxEntries, Nonce};
use wasm_bindgen::prelude::*;

use super::*;
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
pub struct WasmWallet {
    inner: Wallet,
}

#[derive(Serialize, Deserialize)]
pub struct IssueArgs {
    attributes: Vec<delanocreds::Attribute>,
    max_entries: MaxEntries,
    options: Option<IssueOptions>,
}

#[wasm_bindgen]
impl WasmWallet {
    /// Creates a new Wallet
    #[wasm_bindgen(constructor)]
    pub fn new(credentials: JsValue) -> Result<WasmWallet, JsValue> {
        let credentials: Credentials = serde_wasm_bindgen::from_value(credentials)?;

        let inner = Wallet::new(credentials).map_err(|e| JsValue::from_str(&e))?;

        Ok(WasmWallet { inner })
    }

    /// Returns the Nym Proof for this Wallet's Delanocreds Feature
    #[wasm_bindgen(js_name = nymProof)]
    pub fn nym_proof(&self, nonce: &[u8]) -> Result<JsValue, JsValue> {
        let proof = self.inner.delano.nym_proof(nonce.to_vec());
        Ok(serde_wasm_bindgen::to_value(&proof)?)
    }

    /// Issue a new credential, optionally with IssuersOptions, and return the credential
    #[wasm_bindgen]
    pub fn issue(&mut self, args: JsValue) -> Result<JsValue, JsValue> {
        let IssueArgs {
            attributes,
            max_entries,
            options,
        } = serde_wasm_bindgen::from_value(args)?;

        let cred = self.inner.delano.issue(attributes, max_entries, options);
        Ok(serde_wasm_bindgen::to_value(&cred)?)
    }
}
