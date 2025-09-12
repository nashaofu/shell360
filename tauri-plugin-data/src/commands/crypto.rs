// use defendor::{biometric::Biometric, password::Password};
use sea_orm::{ActiveModelTrait, TransactionTrait};
use tauri::{AppHandle, Runtime, State};
use tokio::fs;
// use zeroize::Zeroizing;

use crate::{
    commands::{
        host::{self, Host},
        key::{self, Key},
        port_forwarding::{self, PortForwarding},
        ModelConvert,
    },
    crypto_manager::CryptoManager,
    data_manager::DataManager,
    error::{DataError, DataResult},
    utils::get_db_path,
};

#[tauri::command]
pub async fn check_is_enable_crypto<R: Runtime>(
    _app_handle: AppHandle<R>,
    crypto_manager: State<'_, CryptoManager<R>>,
) -> DataResult<bool> {
    Ok(crypto_manager.is_enable_crypto())
}

#[tauri::command]
pub async fn check_is_init_crypto<R: Runtime>(
    _app_handle: AppHandle<R>,
    crypto_manager: State<'_, CryptoManager<R>>,
) -> DataResult<bool> {
    Ok(crypto_manager.is_init_crypto().await)
}

#[tauri::command]
pub async fn check_is_authed<R: Runtime>(
    _app_handle: AppHandle<R>,
    crypto_manager: State<'_, CryptoManager<R>>,
) -> DataResult<bool> {
    Ok(*crypto_manager.is_authed.read().await)
}

#[tauri::command]
pub async fn init_crypto_key<R: Runtime>(
    _app_handle: AppHandle<R>,
    crypto_manager: State<'_, CryptoManager<R>>,
) -> DataResult<()> {
    crypto_manager.init_crypto_key().await?;

    Ok(())
}

#[tauri::command]
pub async fn init_crypto_password<R: Runtime>(
    _app_handle: AppHandle<R>,
    crypto_manager: State<'_, CryptoManager<R>>,
    password: String,
    confirm_password: String,
) -> DataResult<()> {
    crypto_manager
        .init_crypto_password(password, confirm_password)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn load_crypto_by_password<R: Runtime>(
    _app_handle: AppHandle<R>,
    crypto_manager: State<'_, CryptoManager<R>>,
    password: String,
) -> DataResult<()> {
    crypto_manager.load_crypto_by_password(password).await?;

    Ok(())
}

#[tauri::command]
pub async fn change_crypto_password<R: Runtime>(
    _app_handle: AppHandle<R>,
    crypto_manager: State<'_, CryptoManager<R>>,
    old_password: String,
    password: String,
    confirm_password: String,
) -> DataResult<()> {
    crypto_manager
        .change_crypto_password(old_password, password, confirm_password)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn init_crypto_biometric<R: Runtime>(
    _app_handle: AppHandle<R>,
    _crypto_manager: State<'_, CryptoManager<R>>,
) -> DataResult<()> {
    unimplemented!();
}

#[tauri::command]
pub async fn load_crypto_by_biometric<R: Runtime>(
    _app_handle: AppHandle<R>,
    _crypto_manager: State<'_, CryptoManager<R>>,
) -> DataResult<()> {
    unimplemented!();
}

async fn update_database<R: Runtime>(
    crypto_manager: &State<'_, CryptoManager<R>>,
    data_manager: &State<'_, DataManager>,
    hosts: &Vec<Host>,
    keys: &Vec<Key>,
    port_forwardings: &Vec<PortForwarding>,
) -> DataResult<()> {
    let tx = data_manager.database_connection.begin().await?;

    for host in hosts {
        host.into_active_model(&crypto_manager)
            .await?
            .update(&data_manager.database_connection)
            .await?;
    }

    for key in keys {
        key.into_active_model(&crypto_manager)
            .await?
            .update(&data_manager.database_connection)
            .await?;
    }

    for port_forwarding in port_forwardings {
        port_forwarding
            .into_active_model(&crypto_manager)
            .await?
            .update(&data_manager.database_connection)
            .await?;
    }

    tx.commit().await?;

    Ok(())
}

#[tauri::command]
pub async fn change_crypto_enable<R: Runtime>(
    app_handle: AppHandle<R>,
    crypto_manager: State<'_, CryptoManager<R>>,
    data_manager: State<'_, DataManager>,
    crypto_enable: bool,
    password: Option<String>,
    confirm_password: Option<String>,
) -> DataResult<()> {
    if crypto_enable && (password.is_none() || confirm_password.is_none()) {
        return Err(DataError::CryptoPasswordRequired);
    }

    let hosts = host::get_hosts(
        app_handle.clone(),
        crypto_manager.clone(),
        data_manager.clone(),
    )
    .await?;
    let keys = key::get_keys(
        app_handle.clone(),
        crypto_manager.clone(),
        data_manager.clone(),
    )
    .await?;
    let port_forwardings = port_forwarding::get_port_forwardings(
        app_handle.clone(),
        crypto_manager.clone(),
        data_manager.clone(),
    )
    .await?;

    let old_crypto_enable = crypto_manager.is_enable_crypto();
    crypto_manager.set_enable_crypto(crypto_enable);

    if crypto_enable {
        crypto_manager.init_crypto_key().await?;
        crypto_manager
            .init_crypto_password(password.unwrap(), confirm_password.unwrap())
            .await?;
    }

    match update_database(
        &crypto_manager,
        &data_manager,
        &hosts,
        &keys,
        &port_forwardings,
    )
    .await
    {
        Ok(_) => {
            if !crypto_enable {
                crypto_manager.clear_crypto().await?;
            }
        }
        Err(_) => {
            crypto_manager.set_enable_crypto(old_crypto_enable);
            if !old_crypto_enable {
                crypto_manager.clear_crypto().await?;
            }
        }
    };

    Ok(())
}

#[tauri::command]
pub async fn reset_crypto<R: Runtime>(
    app_handle: AppHandle<R>,
    data_manager: State<'_, DataManager>,
    crypto_manager: State<'_, CryptoManager<R>>,
) -> DataResult<()> {
    crypto_manager.set_enable_crypto(false);
    crypto_manager.clear_crypto().await?;
    let db_path = get_db_path(&app_handle)?;
    data_manager.database_connection.clone().close().await?;

    // 不管成功失败都执行后续操作
    let _ = fs::remove_file(db_path).await;

    app_handle.restart();
}

#[tauri::command]
pub async fn rotate_crypto_key<R: Runtime>(
    _app_handle: AppHandle<R>,
    _crypto_manager: State<'_, CryptoManager<R>>,
    _data_manager: State<'_, DataManager>,
    _password: String,
) -> DataResult<()> {
    unimplemented!();
    // 校验原密码是否正确，密码正确才能重置
    // check_password(app_handle.clone(), password.clone()).await?;

    // let hosts = host::get_hosts(
    //     app_handle.clone(),
    //     crypto_manager.clone(),
    //     data_manager.clone(),
    // )
    // .await?;
    // let keys = key::get_keys(
    //     app_handle.clone(),
    //     crypto_manager.clone(),
    //     data_manager.clone(),
    // )
    // .await?;
    // let port_forwardings = port_forwarding::get_port_forwardings(
    //     app_handle.clone(),
    //     crypto_manager.clone(),
    //     data_manager.clone(),
    // )
    // .await?;

    // let mut defendor = crypto_manager.defendor.write().await;
    // defendor.init_key().await?;
    // defendor
    //     .init_password(Zeroizing::new(password.into_bytes()))
    //     .await?;

    // defendor.init_biometric("Shell360").await?;

    // let tx = data_manager.database_connection.begin().await?;

    // for host in hosts {
    //     host.into_active_model(&crypto_manager)
    //         .await?
    //         .update(&data_manager.database_connection)
    //         .await?;
    // }

    // for key in keys {
    //     key.into_active_model(&crypto_manager)
    //         .await?
    //         .update(&data_manager.database_connection)
    //         .await?;
    // }

    // for port_forwarding in port_forwardings {
    //     port_forwarding
    //         .into_active_model(&crypto_manager)
    //         .await?
    //         .update(&data_manager.database_connection)
    //         .await?;
    // }

    // tx.commit().await?;

    // Ok(())
}
