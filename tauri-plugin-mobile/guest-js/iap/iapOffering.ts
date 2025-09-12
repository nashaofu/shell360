export enum IapPackageType {
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

export enum IapProductType {
  Consumable = 0,
  NonConsumable = 1,
  NonRenewableSubscription = 2,
  AutoRenewableSubscription = 3,
}

export enum IapProductCategory {
  Subscription = 0,
  NonSubscription = 1,
}

export enum IapSubscriptionPeriodUnit {
  Day = 0,
  Week = 1,
  Month = 2,
  Year = 3,
}

export type IapSubscriptionPeriod = {
  value: number;
  unit: IapSubscriptionPeriodUnit;
};

export type IapStoreProductDiscount = {
  offerIdentifier?: string;
  currencyCode?: string;
  price: number;
  localizedPriceString: string;
  paymentMode: IapPaymentMode;
  subscriptionPeriod: IapSubscriptionPeriod;
  numberOfPeriods: number;
  type: IapDiscountType;
};

export enum IapPaymentMode {
  PayAsYouGo = 0,
  PayUpFront = 1,
  FreeTrial = 2,
}

export enum IapDiscountType {
  Introductory = 0,
  Promotional = 1,
}

export type IapStoreProduct = {
  productType: IapProductType;
  productCategory: IapProductCategory;
  localizedDescription: string;
  localizedTitle: string;
  currencyCode?: string;
  price: number;
  localizedPriceString: string;
  productIdentifier: string;
  isFamilyShareable?: boolean;
  subscriptionGroupIdentifier?: string;
  subscriptionPeriod?: IapSubscriptionPeriod;
  introductoryDiscount?: IapStoreProductDiscount;
  discounts: IapStoreProductDiscount[];
};

export type IapPackage = {
  identifier: string;
  packageType: IapPackageType;
  storeProduct: IapStoreProduct;
};

export type IapOffering = {
  identifier: string;
  serverDescription: string;
  availablePackages: IapPackage[];
  lifetime: IapPackage | null;
  annual: IapPackage | null;
  sixMonth: IapPackage | null;
  threeMonth: IapPackage | null;
  twoMonth: IapPackage | null;
  monthly: IapPackage | null;
  weekly: IapPackage | null;
};
