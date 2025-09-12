import Foundation
import RevenueCat

enum IapPeriodType: Int, Codable {
  case normal = 0
  case intro = 1
  case trial = 2
}

enum IapStore: Int, Codable {
  case appStore = 0
  case macAppStore = 1
  case playStore = 2
  case stripe = 3
  case promotional = 4
  case unknownStore = 5
  case amazon = 6
  case rCBilling = 7
  case external = 8
}

enum IapOwnershipType: Int, Codable {
  case purchased = 0
  case familyShared = 1
  case unknown = 2
}

enum IapVerification: Int, Codable {
  case notRequested = 0
  case verified = 1
  case verifiedOnDevice = 3
  case failed = 2
}

struct IapEntitlementInfo: Codable {
  let identifier: String
  let isActive: Bool
  let willRenew: Bool
  let periodType: IapPeriodType
  let latestPurchaseDate: Double?
  let originalPurchaseDate: Double?
  let expirationDate: Double?
  let store: IapStore
  let productIdentifier: String
  let productPlanIdentifier: String?
  let isSandbox: Bool
  let unsubscribeDetectedAt: Double?
  let billingIssueDetectedAt: Double?
  let ownershipType: IapOwnershipType
  let verification: IapVerification
  init(entitlementInfo: EntitlementInfo) {
    self.identifier = entitlementInfo.identifier
    self.isActive = entitlementInfo.isActive
    self.willRenew = entitlementInfo.willRenew
    self.periodType = IapPeriodType(rawValue: entitlementInfo.periodType.rawValue)!
    self.latestPurchaseDate = entitlementInfo.latestPurchaseDate?.timeIntervalSince1970
    self.originalPurchaseDate = entitlementInfo.originalPurchaseDate?.timeIntervalSince1970
    self.expirationDate = entitlementInfo.expirationDate?.timeIntervalSince1970
    self.store = IapStore(rawValue: entitlementInfo.store.rawValue)!
    self.productIdentifier = entitlementInfo.productIdentifier
    self.productPlanIdentifier = entitlementInfo.productPlanIdentifier
    self.isSandbox = entitlementInfo.isSandbox
    self.unsubscribeDetectedAt = entitlementInfo.unsubscribeDetectedAt?.timeIntervalSince1970
    self.billingIssueDetectedAt = entitlementInfo.billingIssueDetectedAt?.timeIntervalSince1970
    self.ownershipType = IapOwnershipType(rawValue: entitlementInfo.ownershipType.rawValue)!
    self.verification = IapVerification(rawValue: entitlementInfo.verification.rawValue)!
  }
}

struct IapEntitlementInfos: Codable {
  let all: [String: IapEntitlementInfo]
  let verification: IapVerification
  init(entitlementInfos: EntitlementInfos) {
    self.all = entitlementInfos.all.mapValues { IapEntitlementInfo(entitlementInfo: $0) }
    self.verification = IapVerification(rawValue: entitlementInfos.verification.rawValue)!
  }
}

struct NonSubscription: Codable {
  let productIdentifier: String
  let purchaseDate: Double
  let transactionIdentifier: String
  let storeTransactionIdentifier: String

  init(nonSubscriptionTransaction: NonSubscriptionTransaction) {
    self.productIdentifier = nonSubscriptionTransaction.productIdentifier
    self.purchaseDate = nonSubscriptionTransaction.purchaseDate.timeIntervalSince1970
    self.transactionIdentifier = nonSubscriptionTransaction.transactionIdentifier
    self.storeTransactionIdentifier = nonSubscriptionTransaction.storeTransactionIdentifier
  }
}

struct IapCustomerInfo: Codable {
  let entitlements: IapEntitlementInfos
  let activeSubscriptions: [String]
  let allPurchasedProductIdentifiers: [String]
  let latestExpirationDate: Double?
  let nonSubscriptions: [NonSubscription]
  let requestDate: Double
  let firstSeen: Double
  let originalAppUserId: String
  let managementURL: String?
  let originalPurchaseDate: Double?
  let originalApplicationVersion: String?

  init(customerInfo: CustomerInfo) {
    self.entitlements = IapEntitlementInfos(entitlementInfos: customerInfo.entitlements)
    self.activeSubscriptions = customerInfo.activeSubscriptions.map { $0 }
    self.allPurchasedProductIdentifiers = customerInfo.allPurchasedProductIdentifiers.map { $0 }
    self.latestExpirationDate = customerInfo.latestExpirationDate?.timeIntervalSince1970
    self.nonSubscriptions = customerInfo.nonSubscriptions.map {
      NonSubscription(nonSubscriptionTransaction: $0)
    }
    self.requestDate = customerInfo.requestDate.timeIntervalSince1970
    self.firstSeen = customerInfo.firstSeen.timeIntervalSince1970
    self.originalAppUserId = customerInfo.originalAppUserId
    self.managementURL = customerInfo.managementURL?.absoluteString
    self.originalPurchaseDate = customerInfo.originalPurchaseDate?.timeIntervalSince1970
    self.originalApplicationVersion = customerInfo.originalApplicationVersion
  }
}
