import RevenueCat
import RevenueCatUI
import Tauri
import UIKit
import WebKit

class IapPaywallViewController: UIViewController {
  var webview: WKWebView?
  var invoke: Invoke?

  init(webview: WKWebView, invoke: Invoke) {
    super.init(nibName: nil, bundle: nil)
    self.webview = webview
    self.invoke = invoke
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }

  @available(iOS 15.0, *)
  @IBAction func presentPaywall() {
    if let webview = self.webview {
      let controller = PaywallViewController()

      self.view.frame = webview.bounds
      if let superView = webview.superview {
        superView.addSubview(self.view)
      }

      controller.delegate = self
      present(controller, animated: true, completion: nil)
    }
  }

  public func removeFromSuperview() {
    self.view.removeFromSuperview()
  }
}

@available(iOS 15.0, *)
extension IapPaywallViewController: PaywallViewControllerDelegate {
  func paywallViewControllerWasDismissed(_ controller: PaywallViewController) {
    self.removeFromSuperview()

    self.invoke?.resolve(true)
  }
}
