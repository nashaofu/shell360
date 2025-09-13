use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapPackageType {
  Unknown = -2,
  Custom = -1,
  Lifetime = 0,
  Annual = 1,
  SixMonth = 2,
  ThreeMonth = 3,
  TwoMonth = 4,
  Monthly = 5,
  Weekly = 6,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapProductType {
  Consumable = 0,
  NonConsumable = 1,
  NonRenewableSubscription = 2,
  AutoRenewableSubscription = 3,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapProductCategory {
  Subscription = 0,
  NonSubscription = 1,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapSubscriptionPeriodUnit {
  Day = 0,
  Week = 1,
  Month = 2,
  Year = 3,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IapSubscriptionPeriod {
  pub value: i32,
  pub unit: IapSubscriptionPeriodUnit,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IapStoreProductDiscount {
  pub offer_identifier: Option<String>,
  pub currency_code: Option<String>,
  pub price: f64,
  pub localized_price_string: String,
  pub payment_mode: IapPaymentMode,
  pub subscription_period: IapSubscriptionPeriod,
  pub number_of_periods: i32,
  pub type_: IapDiscountType,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapPaymentMode {
  PayAsYouGo = 0,
  PayUpFront = 1,
  FreeTrial = 2,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IapDiscountType {
  Introductory = 0,
  Promotional = 1,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IapStoreProduct {
  pub product_type: IapProductType,
  pub product_category: IapProductCategory,
  pub localized_description: String,
  pub localized_title: String,
  pub currency_code: Option<String>,
  pub price: f64,
  pub localized_price_string: String,
  pub product_identifier: String,
  pub is_family_shareable: Option<bool>,
  pub subscription_group_identifier: Option<String>,
  pub subscription_period: Option<IapSubscriptionPeriod>,
  pub introductory_discount: Option<IapStoreProductDiscount>,
  pub discounts: Vec<IapStoreProductDiscount>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IapPackage {
  pub identifier: String,
  pub package_type: IapPackageType,
  pub store_product: IapStoreProduct,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IapOffering {
  pub identifier: String,
  pub server_description: String,
  pub available_packages: Vec<IapPackage>,
  pub lifetime: Option<IapPackage>,
  pub annual: Option<IapPackage>,
  pub six_month: Option<IapPackage>,
  pub three_month: Option<IapPackage>,
  pub two_month: Option<IapPackage>,
  pub monthly: Option<IapPackage>,
  pub weekly: Option<IapPackage>,
}
