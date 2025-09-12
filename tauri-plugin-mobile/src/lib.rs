mod api;
mod error;
mod iap;

use serde::Deserialize;
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, Runtime,
};

pub use api::*;
pub use error::{Error, Result};
pub use iap::*;

/// Access to the mobile APIs.
pub struct Mobile<R: Runtime>(PluginHandle<R>);
/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the mobile APIs.
pub trait MobileExt<R: Runtime> {
    fn mobile(&self) -> &Mobile<R>;
}

impl<R: Runtime, T: Manager<R>> MobileExt<R> for T {
    fn mobile(&self) -> &Mobile<R> {
        self.state::<Mobile<R>>().inner()
    }
}

// 定义插件配置
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfig {
    #[allow(dead_code)]
    revenue_cat_key: String,
}

impl<R: Runtime> Mobile<R> {
    pub async fn iap_get_customer_info(&self) -> crate::Result<IapCustomerInfo> {
        self.0
            .run_mobile_plugin("iapGetCustomerInfo", "")
            .map_err(Into::into)
    }

    pub async fn iap_get_offerings(&self) -> crate::Result<String> {
        self.0
            .run_mobile_plugin("iapGetOfferings", "")
            .map_err(Into::into)
    }

    pub async fn iap_purchase_package(
        &self,
        iap_purchase_package_request: IapPurchasePackageRequest,
    ) -> crate::Result<IapCustomerInfo> {
        self.0
            .run_mobile_plugin("iapPurchasePackage", iap_purchase_package_request)
            .map_err(Into::into)
    }

    pub async fn iap_restore(&self) -> crate::Result<IapCustomerInfo> {
        self.0
            .run_mobile_plugin("iapRestore", "")
            .map_err(Into::into)
    }

    pub async fn iap_show_paywall(&self) -> crate::Result<bool> {
        self.0
            .run_mobile_plugin("iapShowPaywall", "")
            .map_err(Into::into)
    }

    pub async fn export_text_file(
        &self,
        export_text_file_request: ExportTextFileRequest,
    ) -> crate::Result<ExportTextFileResponse> {
        self.0
            .run_mobile_plugin("exportTextFile", export_text_file_request)
            .map_err(Into::into)
    }
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_mobile);

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R, PluginConfig> {
    Builder::<R, PluginConfig>::new("mobile")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let handle = api.register_android_plugin("com.nashaofu.mobile", "MobilePlugin")?;
            #[cfg(target_os = "ios")]
            let handle = api.register_ios_plugin(init_plugin_mobile)?;

            app.manage(Mobile(handle));
            Ok(())
        })
        .build()
}
