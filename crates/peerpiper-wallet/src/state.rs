//! State of the app. This is so you can serialize the state and push it places like
//! window.location.hash or localStorage.

use serde::{Deserialize, Serialize};

/// The state of the app. This is so you can serialize the state and push it places like
/// window.location.hash or localStorage.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct State {
    /// The encrypted seed, serializes as base64url unpadded.
    encrypted: Option<Vec<u8>>,
    username: Option<String>,
}

impl State {
    /// Set the encrypted seed.
    pub fn with_encrypted(mut self, encrypted: Vec<u8>) -> Self {
        self.encrypted = Some(encrypted);
        self
    }
}
