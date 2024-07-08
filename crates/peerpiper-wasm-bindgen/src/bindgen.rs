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

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct IssueArgs {
    attributes: Vec<delanocreds::Attribute>,
    max_entries: MaxEntries,
    options: Option<IssueOptions>,
}

/// COstructor Arguments are username, password, and optionally an encrypted seed of Uint8Array (Vec<u8>)
#[derive(Serialize, Deserialize, Default, Debug)]
pub struct CredArgs {
    username: String,
    password: String,
    encrypted_seed: Option<Vec<u8>>,
}

/// Bindings for [Attribute](delanocreds::Attribute) so that the user can create a new Attribute
/// from bytes
#[wasm_bindgen]
pub fn attribute(bytes: &[u8]) -> Result<JsValue, JsValue> {
    let attr = Attribute::new(bytes);
    Ok(serde_wasm_bindgen::to_value(&attr)?)
}

#[wasm_bindgen]
impl WasmWallet {
    /// Creates a new Wallet
    #[wasm_bindgen(constructor)]
    pub fn new(credentials: JsValue) -> Result<WasmWallet, JsValue> {
        let cred_args: CredArgs = serde_wasm_bindgen::from_value(credentials).map_err(|e| {
            JsValue::from_str(&format!(
                "Expected: {:?}, Got: {:?}",
                Credentials::default(),
                e
            ))
        })?;

        // Try to convert the cred_args into a Credentials struct. It may fail if the username or password are too short
        let credentials = Credentials::new(
            cred_args.username.as_str(),
            cred_args.password.as_str(),
            cred_args.encrypted_seed,
        )
        .map_err(|e| JsValue::from_str(&e))?;

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
        } = serde_wasm_bindgen::from_value(args).map_err(|e| {
            // Insert hint into return String, with an example of the Args needed by printing out IssueArgs
            JsValue::from_str(&format!(
                "Expected: {:?}, Got: {:?}",
                IssueArgs::default(),
                e
            ))
        })?;

        let cred = self.inner.delano.issue(attributes, max_entries, options);
        Ok(serde_wasm_bindgen::to_value(&cred)?)
    }

    // / Create an Offer
}
