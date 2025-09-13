use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapPeriodType {
  Normal = 0,
  Intro = 1,
  Trial = 2,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapStore {
  AppStore = 0,
  MacAppStore = 1,
  PlayStore = 2,
  Stripe = 3,
  Promotional = 4,
  UnknownStore = 5,
  Amazon = 6,
  RCBilling = 7,
  External = 8,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapOwnershipType {
  Purchased = 0,
  FamilyShared = 1,
  Unknown = 2,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapVerification {
  NotRequested = 0,
  Verified = 1,
  VerifiedOnDevice = 3,
  Failed = 2,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IapEntitlementInfo {
  pub identifier: String,
  pub is_active: bool,
  pub will_renew: bool,
  pub period_type: IapPeriodType,
  pub latest_purchase_date: Option<f64>,
  pub original_purchase_date: Option<f64>,
  pub expiration_date: Option<f64>,
  pub store: IapStore,
  pub product_identifier: String,
  pub product_plan_identifier: Option<String>,
  pub is_sandbox: bool,
  pub unsubscribe_detected_at: Option<f64>,
  pub billing_issue_detected_at: Option<f64>,
  pub ownership_type: IapOwnershipType,
  pub verification: IapVerification,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IapEntitlementInfos {
  pub all: HashMap<String, IapEntitlementInfo>,
  pub verification: IapVerification,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NonSubscription {
  pub product_identifier: String,
  pub purchase_date: f64,
  pub transaction_identifier: String,
  pub store_transaction_identifier: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IapCustomerInfo {
  pub entitlements: IapEntitlementInfos,
  pub active_subscriptions: Vec<String>,
  pub all_purchased_product_identifiers: Vec<String>,
  pub latest_expiration_date: Option<f64>,
  pub non_subscriptions: Vec<NonSubscription>,
  pub request_date: f64,
  pub first_seen: f64,
  pub original_app_user_id: String,
  pub management_url: Option<String>,
  pub original_purchase_date: Option<f64>,
  pub original_application_version: Option<String>,
}
