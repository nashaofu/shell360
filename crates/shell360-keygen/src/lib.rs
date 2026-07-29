use serde::{Deserialize, Serialize};
use ssh_key::{
  EcdsaCurve, LineEnding, PrivateKey,
  private::{EcdsaKeypair, Ed25519Keypair, KeypairData, RsaKeypair},
  rand_core::OsRng,
};
use thiserror::Error;

pub type KeygenResult<T> = Result<T, KeygenError>;

#[derive(Debug, Error)]
pub enum KeygenError {
  #[error(transparent)]
  SshKey(#[from] ssh_key::Error),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(remote = "EcdsaCurve", rename_all_fields = "camelCase")]
enum EcdsaCurveDef {
  NistP256,
  NistP384,
  NistP521,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all_fields = "camelCase")]
pub enum Algorithm {
  Ed25519,
  Rsa {
    bit_size: usize,
  },
  Ecdsa {
    #[serde(with = "EcdsaCurveDef")]
    curve: EcdsaCurve,
  },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedKey {
  pub private_key: String,
  pub public_key: String,
}

pub fn generate_key(algorithm: Algorithm, passphrase: Option<&str>) -> KeygenResult<GeneratedKey> {
  let keypair_data = match algorithm {
    Algorithm::Ed25519 => KeypairData::from(Ed25519Keypair::random(&mut OsRng)),
    Algorithm::Rsa { bit_size } => KeypairData::from(RsaKeypair::random(&mut OsRng, bit_size)?),
    Algorithm::Ecdsa { curve } => KeypairData::from(EcdsaKeypair::random(&mut OsRng, curve)?),
  };

  let mut private_key = PrivateKey::new(keypair_data, "shell360")?;
  if let Some(passphrase) = passphrase.filter(|value| !value.is_empty()) {
    private_key = private_key.encrypt(&mut OsRng, passphrase)?;
    private_key.set_comment("shell360");
  }

  Ok(GeneratedKey {
    private_key: private_key.to_openssh(LineEnding::LF)?.to_string(),
    public_key: private_key.public_key().to_openssh()?.to_string(),
  })
}

#[cfg(test)]
mod tests {
  use super::{Algorithm, generate_key};
  use ssh_key::{EcdsaCurve, PrivateKey, PublicKey};

  #[test]
  fn generates_ed25519_key() {
    let key = generate_key(Algorithm::Ed25519, None).expect("generate ed25519 key");

    PrivateKey::from_openssh(&key.private_key).expect("parse private key");
    PublicKey::from_openssh(&key.public_key).expect("parse public key");
  }

  #[test]
  fn generates_encrypted_ed25519_key() {
    let key = generate_key(Algorithm::Ed25519, Some("password")).expect("generate encrypted key");
    let private_key = PrivateKey::from_openssh(&key.private_key).expect("parse private key");

    assert!(private_key.is_encrypted());
    private_key
      .decrypt("password")
      .expect("decrypt private key");
  }

  #[test]
  fn generates_rsa_key() {
    let key = generate_key(Algorithm::Rsa { bit_size: 2048 }, None).expect("generate rsa key");

    PrivateKey::from_openssh(&key.private_key).expect("parse private key");
  }

  #[test]
  fn generates_ecdsa_key() {
    let key = generate_key(
      Algorithm::Ecdsa {
        curve: EcdsaCurve::NistP256,
      },
      None,
    )
    .expect("generate ecdsa key");

    PrivateKey::from_openssh(&key.private_key).expect("parse private key");
  }
}
