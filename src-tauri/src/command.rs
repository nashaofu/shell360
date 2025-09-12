use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use ssh_key::{
    private::{EcdsaKeypair, Ed25519Keypair, KeypairData, RsaKeypair},
    EcdsaCurve, LineEnding, PrivateKey,
};
use webbrowser;

use crate::error::Shell360Result;

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Key {
    private_key: String,
    public_key: String,
}

#[tauri::command]
pub async fn generate_key(algorithm: Algorithm, passphrase: Option<&str>) -> Shell360Result<Key> {
    let keypair_data = match algorithm {
        Algorithm::Ed25519 => KeypairData::from(Ed25519Keypair::random(&mut OsRng)),
        Algorithm::Rsa { bit_size } => KeypairData::from(RsaKeypair::random(&mut OsRng, bit_size)?),
        Algorithm::Ecdsa { curve } => KeypairData::from(EcdsaKeypair::random(&mut OsRng, curve)?),
    };

    let mut private_key = PrivateKey::new(keypair_data, "shell360")?;
    if let Some(passphrase) = passphrase.filter(|v| !v.is_empty()) {
        private_key = private_key.encrypt(&mut OsRng, passphrase)?;
        private_key.set_comment("shell360");
    }

    Ok(Key {
        private_key: private_key.to_openssh(LineEnding::LF)?.to_string(),
        public_key: private_key.public_key().to_openssh()?.to_string(),
    })
}

#[tauri::command]
pub async fn open_url(url: String) -> Shell360Result<()> {
    webbrowser::open(&url)?;

    Ok(())
}
