//! Delanocreds wallet code

use delano_keys::kdf::{ExposeSecret, Manager, Zeroizing};
use delano_keys::{
    kdf::Scalar,
    //    vk::VKCompressed
};
use delanocreds::keypair::{CredProofCompressed, IssuerPublicCompressed, NymProofCompressed};
use delanocreds::CredentialCompressed;
use delanocreds::{
    verify_proof, CredProof, Credential, Entry, Initial, Issuer, IssuerPublic, MaxCardinality,
    MaxEntries, Nonce, Nym, NymProof, Secret,
};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Delano Wallet
pub(crate) struct DelanoWallet {
    expanded: Secret<Vec<Scalar>>,
    nym: Nym<Initial>,
    issuer: Issuer,
}

impl DelanoWallet {
    /// Creates a new wallet from the given seed
    pub fn new(seed: impl AsRef<[u8]> + Zeroize + ZeroizeOnDrop) -> Self {
        let manager = Manager::from_seed(seed);

        let account = manager.account(1);

        let expanded = account.expand_to(MaxEntries::default().into());

        let nym = Nym::from_secret(expanded.expose_secret().clone()[0].into());

        let issuer = Issuer::new_with_secret(
            expanded.expose_secret().clone().into(),
            MaxCardinality::default(),
        );

        Self {
            expanded,
            nym,
            issuer,
        }
    }
}
