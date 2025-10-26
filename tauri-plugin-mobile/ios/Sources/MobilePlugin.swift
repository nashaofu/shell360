import RevenueCat
import StoreKit
import SwiftRs
import Tauri
import UIKit
import WebKit

struct PluginConfig: Decodable {
  let revenueCatKey: String
}

struct PurchasePackageRequest: Decodable {
  let packageIdentifier: String
}

struct ExportTextFileRequest: Decodable {
  let filename: String
  let data: String
}

class MobilePlugin: Plugin {
  var webview: WKWebView!
  var pluginConfig: PluginConfig!
  var iapPaywallViewController: IapPaywallViewController?

  public override func load(webview: WKWebView) {
    do {
      self.pluginConfig = try self.parseConfig(PluginConfig.self)
    } catch {
      // 在这里处理错误，例如打印错误信息或结束程序
      fatalError("Failed to parse plugin configuration. Check your configuration settings.")
    }

    self.webview = webview
    Purchases.logLevel = .debug
    Purchases.configure(
      with: Configuration.Builder(withAPIKey: self.pluginConfig.revenueCatKey).build()
    )
  }

  @objc public func iapGetCustomerInfo(_ invoke: Invoke) throws {
    Task {
      do {
        let customerInfo = try await Purchases.shared.customerInfo()
        invoke.resolve(IapCustomerInfo(customerInfo: customerInfo))
      } catch {
        invoke.reject(error.localizedDescription)
      }
    }
  }

  @objc public func iapGetOfferings(_ invoke: Invoke) throws {
    Task {
      do {
        let offerings = try await Purchases.shared.offerings()
        invoke.resolve(offerings.all.values.map({ IapOffering(offering: $0) }))
      } catch {
        invoke.reject(error.localizedDescription)
      }
    }
  }

  @objc public func iapPurchasePackage(_ invoke: Invoke) throws {
    Task {
      do {
        let args = try invoke.parseArgs(PurchasePackageRequest.self)

        let offerings = try await Purchases.shared.offerings()
        let packages = offerings.current?.availablePackages
        if let package = packages?.first(where: { $0.identifier == args.packageIdentifier }) {
          let result = try await Purchases.shared.purchase(package: package)
          invoke.resolve(IapCustomerInfo(customerInfo: result.customerInfo))
        } else {
          invoke.reject("Not found product, Please call the getPaywallProducts method first")
        }
      } catch {
        invoke.reject(error.localizedDescription)
      }
    }
  }

  @objc public func iapRestore(_ invoke: Invoke) throws {
    Task {
      do {
        let customerInfo = try await Purchases.shared.restorePurchases()
        invoke.resolve(IapCustomerInfo(customerInfo: customerInfo))
      } catch {
        invoke.reject(error.localizedDescription)
      }
    }
  }

  @objc public func iapShowPaywall(_ invoke: Invoke) throws {
    Task {
      if #available(iOS 15.0, *) {
        await self.iapPaywallViewController?.removeFromSuperview()
        self.iapPaywallViewController = await IapPaywallViewController(
          webview: self.webview,
          invoke: invoke
        )
        await self.iapPaywallViewController?.presentPaywall()
      } else {
        invoke.resolve(false)
      }
    }
  }

  @objc public func exportTextFile(_ invoke: Invoke) throws {
    Task {
      do {
        let args = try invoke.parseArgs(ExportTextFileRequest.self)
        if let data = args.data.data(using: .utf8) {

          let completed = try await exportFile(
            view: self.webview,
            filename: args.filename,
            data: data
          )
          invoke.resolve(["cancel": !completed])
        } else {
          invoke.reject("data is invalid")
        }
      } catch {
        invoke.reject(error.localizedDescription)
      }
    }
  }
}

@_cdecl("init_plugin_mobile")
func initPlugin() -> Plugin {
  return MobilePlugin()
}
