mod bindgen;

use seed_keeper_core::seed::rand_seed;
use seed_keeper_core::wrap::{decrypt, encrypt};
use seed_keeper_core::{derive_key, Zeroizing};
use serde::{Deserialize, Serialize};
use std::{marker::PhantomData, ops::Deref};

/// Username, password and Option of Encrypted seed
#[derive(Serialize, Deserialize, Default, Debug)]
pub struct Credentials {
    pub username: MinString<8>,
    pub password: MinString<8>,
    pub encrypted_seed: Option<Vec<u8>>,
}

impl Credentials {
    pub fn new(
        username: &str,
        password: &str,
        encrypted_seed: Option<Vec<u8>>,
    ) -> Result<Self, String> {
        Ok(Credentials {
            username: MinString::new(username)?,
            password: MinString::new(password)?,
            encrypted_seed,
        })
    }
}

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct MinString<const N: usize> {
    value: String,
    _marker: PhantomData<()>,
}

impl<const N: usize> MinString<N> {
    pub fn new(value: &str) -> Result<Self, String> {
        if value.len() >= N {
            Ok(MinString {
                value: value.to_string(),
                _marker: PhantomData,
            })
        } else {
            Err(format!("Must be at least {} characters long", N))
        }
    }

    pub fn value(&self) -> &str {
        &self.value
    }
}

impl<const N: usize> Deref for MinString<{ N }> {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}

pub struct Wallet {
    username: MinString<8>,
    password: MinString<8>,
    seed: Zeroizing<Vec<u8>>,
}

impl Wallet {
    /// Creates a new Wallet from the given credentials
    pub fn new(credentials: Credentials) -> Result<Self, String> {
        let seed = match credentials.encrypted_seed {
            Some(encrypted_seed) => {
                let key = derive_key(
                    credentials.username.value().as_bytes(),
                    credentials.password.value().as_bytes(),
                )
                .map_err(|e| e.to_string())?;

                println!("Key: {:?}", key);

                // Decrypt the given seed with the key, if it fails the username or password is wrong & return error
                let decrypted = decrypt(key.clone(), &encrypted_seed).map_err(|_e| {
                    format!("Username and password does not unlock that seed. Try again!")
                })?;

                if decrypted.len() != 32 {
                    return Err("Seed must be 32 bytes long".to_string());
                }

                decrypted
            }
            None => Zeroizing::new(rand_seed().as_slice().to_vec()),
        };

        Ok(Wallet {
            seed,
            username: credentials.username,
            password: credentials.password,
        })
    }

    /// Returns the encrypted seed
    pub fn encrypted_seed(&self) -> Result<Vec<u8>, seed_keeper_core::error::Error> {
        let key = derive_key(
            self.username.value().as_bytes(),
            self.password.value().as_bytes(),
        )
        .expect("Failed to derive key");

        encrypt(key, self.seed.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        // Create a new wallet
        let credentials = Credentials {
            username: MinString::new("username").unwrap(),
            password: MinString::new("password").unwrap(),
            encrypted_seed: None,
        };

        let wallet = Wallet::new(credentials).expect("Failed to create wallet");

        // Encrypt the seed
        let encrypted_seed = wallet.encrypted_seed().expect("Failed to encrypt seed");

        // Create a new wallet with the encrypted seed
        let credentials = Credentials {
            username: MinString::new("username").unwrap(),
            password: MinString::new("password").unwrap(),
            encrypted_seed: Some(encrypted_seed.clone()),
        };

        let wallet = Wallet::new(credentials).expect("Failed to create wallet");

        // Encrypt the seed
        let encrypted_seed_2 = wallet.encrypted_seed().expect("Failed to encrypt seed");

        assert!(encrypted_seed_2.len() > 0);

        // Should match
        assert_eq!(encrypted_seed, encrypted_seed_2);
    }
}
