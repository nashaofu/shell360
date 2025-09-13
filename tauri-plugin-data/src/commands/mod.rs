pub mod crypto;
pub mod host;
pub mod key;
pub mod port_forwarding;

use tauri::{Runtime, State};

use crate::{crypto_manager::CryptoManager, error::DataResult};

trait ModelConvert: Sized {
  type Model;
  type ActiveModel;
  async fn from_model<R: Runtime>(
    crypto_manager: &State<'_, CryptoManager<R>>,
    model: Self::Model,
  ) -> DataResult<Self>;

  async fn into_active_model<R: Runtime>(
    &self,
    crypto_manager: &State<'_, CryptoManager<R>>,
  ) -> DataResult<Self::ActiveModel>;
}
