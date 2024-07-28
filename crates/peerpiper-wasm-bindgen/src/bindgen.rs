//! Wasm-Bindgen bindings for the PeerPiper Wallet. This crate essentially does the conversion
//! to/from JsValue for the main module.
use delano_keys::publish::{IssuerKey, OfferedPreimages};
use delano_keys::vk::VKCompressed;
use delano_wallet_core::{IssueOptions, OfferConfig, Provables, Verifiables};
use delanocreds::keypair::spseq_uc::CredentialCompressed;
use delanocreds::{Attribute, MaxEntries};
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

/// Offer Arguments
#[derive(Serialize, Deserialize, Debug)]
pub struct OfferArgs {
    credential: CredentialCompressed,
    config: OfferConfig,
}

/// Publishables, the details needed to create a [delano_keys::publish::PublishingKey].
#[derive(Serialize, Deserialize, Debug)]
pub struct Publishables {
    preimages: Vec<Vec<u8>>,
    /// Verification Key can come from provables.issuer_public.vk
    vk: Vec<VKCompressed>,
}

/// Bindings for [Attribute](delanocreds::Attribute) so that the user can create a new Attribute
/// from bytes
#[wasm_bindgen]
pub fn attribute(bytes: &[u8]) -> Result<JsValue, JsValue> {
    let attr = Attribute::new(bytes);
    Ok(serde_wasm_bindgen::to_value(&attr)?)
}

/// Generates the a [delano_keys::publish::PublishingKey] from the given [Publishables]
#[wasm_bindgen(js_name = publishKey)]
pub fn publish_key(publishables: JsValue) -> Result<JsValue, JsValue> {
    let publishables: Publishables =
        serde_wasm_bindgen::from_value(publishables).map_err(|e| e.to_string())?;
    let pk = delano_keys::publish::PublishingKey::new(
        &OfferedPreimages::<Vec<u8>>(&publishables.preimages),
        &IssuerKey(&publishables.vk),
    )
    .cid();

    Ok(serde_wasm_bindgen::to_value(&pk)?)
}

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
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

    /// Returns the Encrypted Seed of the Wallet
    #[wasm_bindgen(js_name = encryptedSeed)]
    pub fn encrypted_seed(&self) -> Result<JsValue, JsValue> {
        let encr_seed = self
            .inner
            .encrypted_seed()
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(serde_wasm_bindgen::to_value(&encr_seed)?)
    }

    /// Returns the Nym Proof for this Wallet's Delanocreds Feature
    #[wasm_bindgen(js_name = nymProof)]
    pub fn nym_proof(&self, nonce: &[u8]) -> Result<JsValue, JsValue> {
        let proof = self.inner.delano.nym_proof(nonce.to_vec());
        Ok(serde_wasm_bindgen::to_value(&proof)?)
    }

    /// Creates and issues a new credential, optionally with IssuersOptions, and returns the created credential.
    /// If no NymProof is included in the options, it generates the Credential for oneself.
    /// If a NymProof is included, it issues the Credential to the NymProof and only they can
    /// offer it to others (delegatee) or extend it.
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

        let cred = self.inner.delano.issue(attributes, max_entries, options)?;
        Ok(serde_wasm_bindgen::to_value(&cred)?)
    }

    /// Create an Offer. Takes an issued credential and OfferConfig, and returns the Orphan Credential
    /// that can only be accpeted by someone who has the attribute values that were included in the
    /// original credential issuance.
    #[wasm_bindgen]
    pub fn offer(&mut self, args: JsValue) -> Result<JsValue, JsValue> {
        let OfferArgs { credential, config } =
            serde_wasm_bindgen::from_value(args).map_err(|e| e.to_string())?;

        let cred = self.inner.delano.offer(credential, config)?;
        Ok(serde_wasm_bindgen::to_value(&cred)?)
    }

    /// Accept an offered credential.
    #[wasm_bindgen]
    pub fn accept(&mut self, cred: JsValue) -> Result<JsValue, JsValue> {
        let credential: CredentialCompressed =
            serde_wasm_bindgen::from_value(cred).map_err(|e| e.to_string())?;
        let cred = self.inner.delano.accept(credential)?;
        Ok(serde_wasm_bindgen::to_value(&cred)?)
    }

    /// Generate a Proof for the given [delano_wallet_core::Provables]
    #[wasm_bindgen]
    pub fn prove(&mut self, provables: JsValue) -> Result<JsValue, JsValue> {
        let provables: Provables =
            serde_wasm_bindgen::from_value(provables).map_err(|e| e.to_string())?;
        let proof = self.inner.delano.prove(provables)?;
        Ok(serde_wasm_bindgen::to_value(&proof)?)
    }

    /// Verify a Proof for the given [delano_wallet_core::Verifiables]
    #[wasm_bindgen]
    pub fn verify(&mut self, verifiables: JsValue) -> Result<JsValue, JsValue> {
        let verifiables: Verifiables = serde_wasm_bindgen::from_value(verifiables)
            .map_err(|e| format!("Error deserde into Verifiables: {:?}", e))?;
        let verified = delano_wallet_core::verify_proof(verifiables)?;
        Ok(serde_wasm_bindgen::to_value(&verified)?)
    }

    /// verify a signature againat a public key and message
    #[wasm_bindgen]
    pub fn verify_signature(
        &self,
        signature: Vec<u8>,
        public_key: Vec<u8>,
        message: Vec<u8>,
    ) -> Result<bool, JsValue> {
        let verified = delano_wallet_core::verify_signature(signature, message, public_key)?;
        Ok(verified)
    }
}
