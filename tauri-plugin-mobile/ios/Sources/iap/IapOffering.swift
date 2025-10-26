import Foundation
import RevenueCat

enum IapPackageType: Int, Codable {
  case unknown = -2
  case custom = -1
  case lifetime = 0
  case annual = 1
  case sixMonth = 2
  case threeMonth = 3
  case twoMonth = 4
  case monthly = 5
  case weekly = 6
}

enum IapProductType: Int, Codable {
  case consumable = 0
  case nonConsumable = 1
  case nonRenewableSubscription = 2
  case autoRenewableSubscription = 3
}

enum IapProductCategory: Int, Codable {
  case subscription = 0
  case nonSubscription = 1
}

enum IapSubscriptionPeriodUnit: Int, Codable {
  case day = 0
  case week = 1
  case month = 2
  case year = 3
}

struct IapSubscriptionPeriod: Codable {
  var value: Int
  var unit: IapSubscriptionPeriodUnit
  init(subscriptionPeriod: SubscriptionPeriod) {
    self.value = subscriptionPeriod.value
    self.unit = IapSubscriptionPeriodUnit(rawValue: subscriptionPeriod.unit.rawValue)!
  }
}

struct IapStoreProductDiscount: Codable {
  var offerIdentifier: String?
  var currencyCode: String?
  var price: Decimal
  var localizedPriceString: String
  var paymentMode: IapPaymentMode
  var subscriptionPeriod: IapSubscriptionPeriod
  var numberOfPeriods: Int
  var type: IapDiscountType

  init(storeProductDiscount: StoreProductDiscount) {
    self.offerIdentifier = storeProductDiscount.offerIdentifier
    self.currencyCode = storeProductDiscount.currencyCode
    self.price = storeProductDiscount.price
    self.localizedPriceString = storeProductDiscount.localizedPriceString
    self.paymentMode = IapPaymentMode(rawValue: storeProductDiscount.paymentMode.rawValue)!
    self.subscriptionPeriod = IapSubscriptionPeriod(
      subscriptionPeriod: storeProductDiscount.subscriptionPeriod)
    self.numberOfPeriods = storeProductDiscount.numberOfPeriods
    self.type = IapDiscountType(rawValue: storeProductDiscount.type.rawValue)!
  }
}

enum IapPaymentMode: Int, Codable {
  case payAsYouGo = 0
  case payUpFront = 1
  case freeTrial = 2
}

enum IapDiscountType: Int, Codable {
  case introductory = 0
  case promotional = 1
}

struct IapStoreProduct: Codable {
  var productType: IapProductType
  var productCategory: IapProductCategory
  var localizedDescription: String
  var localizedTitle: String
  var currencyCode: String?
  var price: Decimal
  var localizedPriceString: String
  var productIdentifier: String
  var isFamilyShareable: Bool?
  var subscriptionGroupIdentifier: String?
  var subscriptionPeriod: IapSubscriptionPeriod?
  var introductoryDiscount: IapStoreProductDiscount?
  var discounts: [IapStoreProductDiscount]
  init(storeProduct: StoreProduct) {
    self.productType = IapProductType(rawValue: storeProduct.productType.rawValue)!
    self.productCategory = IapProductCategory(rawValue: storeProduct.productCategory.rawValue)!
    self.localizedDescription = storeProduct.localizedDescription
    self.localizedTitle = storeProduct.localizedTitle
    self.currencyCode = storeProduct.currencyCode
    self.price = storeProduct.price
    self.localizedPriceString = storeProduct.localizedPriceString
    self.productIdentifier = storeProduct.productIdentifier
    if #available(iOS 14.0, *) {
      self.isFamilyShareable = storeProduct.isFamilyShareable
    } else {
      self.isFamilyShareable = false
    }
    self.subscriptionGroupIdentifier = storeProduct.subscriptionGroupIdentifier

    if let subscriptionPeriod = storeProduct.subscriptionPeriod {
      self.subscriptionPeriod = IapSubscriptionPeriod(subscriptionPeriod: subscriptionPeriod)
    }

    if let introductoryDiscount = storeProduct.introductoryDiscount {
      self.introductoryDiscount = IapStoreProductDiscount(
        storeProductDiscount: introductoryDiscount)
    }

    self.discounts = storeProduct.discounts.map {
      IapStoreProductDiscount(storeProductDiscount: $0)
    }
  }
}

struct IapPackage: Codable {
  var identifier: String
  var packageType: IapPackageType
  var storeProduct: IapStoreProduct
  init(package: Package) {
    self.identifier = package.identifier
    self.packageType = IapPackageType(rawValue: package.packageType.rawValue)!
    self.storeProduct = IapStoreProduct(storeProduct: package.storeProduct)
  }
}

struct IapOffering: Codable {
  var identifier: String
  var serverDescription: String
  var availablePackages: [IapPackage]
  var lifetime: IapPackage?
  var annual: IapPackage?
  var sixMonth: IapPackage?
  var threeMonth: IapPackage?
  var twoMonth: IapPackage?
  var monthly: IapPackage?
  var weekly: IapPackage?

  init(offering: Offering) {
    self.identifier = offering.identifier
    self.serverDescription = offering.serverDescription
    self.availablePackages = offering.availablePackages.map { IapPackage(package: $0) }
    if let lifetime = offering.lifetime {
      self.lifetime = IapPackage(package: lifetime)
    }
    if let annual = offering.annual {
      self.annual = IapPackage(package: annual)
    }
    if let sixMonth = offering.sixMonth {
      self.sixMonth = IapPackage(package: sixMonth)
    }
    if let threeMonth = offering.threeMonth {
      self.threeMonth = IapPackage(package: threeMonth)
    }
    if let twoMonth = offering.twoMonth {
      self.twoMonth = IapPackage(package: twoMonth)
    }
    if let monthly = offering.monthly {
      self.monthly = IapPackage(package: monthly)
    }
    if let weekly = offering.weekly {
      self.weekly = IapPackage(package: weekly)
    }
  }
}
