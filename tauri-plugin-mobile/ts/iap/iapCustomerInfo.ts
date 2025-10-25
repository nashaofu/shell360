export enum IapPeriodType {
  Normal = 0,
  Intro = 1,
  Trial = 2,
}

export enum IapStore {
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

export enum IapOwnershipType {
  Purchased = 0,
  FamilyShared = 1,
  Unknown = 2,
}

export enum IapVerification {
  NotRequested = 0,
  Verified = 1,
  VerifiedOnDevice = 3,
  Failed = 2,
}

export type IapEntitlementInfo = {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  periodType: IapPeriodType;
  latestPurchaseDate: number | null;
  originalPurchaseDate: number | null;
  expirationDate: number | null;
  store: IapStore;
  productIdentifier: string;
  productPlanIdentifier: string | null;
  isSandbox: boolean;
  unsubscribeDetectedAt: number | null;
  billingIssueDetectedAt: number | null;
  ownershipType: IapOwnershipType;
  verification: IapVerification;
};

export type IapEntitlementInfos = {
  all: { [key: string]: IapEntitlementInfo };
  verification: IapVerification;
};

export type NonSubscription = {
  productIdentifier: string;
  purchaseDate: number;
  transactionIdentifier: string;
  storeTransactionIdentifier: string;
};

export type IapCustomerInfo = {
  entitlements: IapEntitlementInfos;
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
  latestExpirationDate: number | null;
  nonSubscriptions: NonSubscription[];
  requestDate: number;
  firstSeen: number;
  originalAppUserId: string;
  managementURL: string | null;
  originalPurchaseDate: number | null;
  originalApplicationVersion: string | null;
};
