import SwiftUI
import UIKit
import WebKit

struct WebViewContainer: UIViewRepresentable {
    let router: BridgeRouter

    func makeCoordinator() -> Coordinator {
        Coordinator(router: router)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "shell360Native")
        controller.addUserScript(WKUserScript(
            source: JavaScriptBridge.adapter,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) {
            webView.isInspectable = AppEnvironment.isDebug
        }
        context.coordinator.webView = webView
        router.eventHandler = { [weak webView] event in
            DispatchQueue.main.async {
                let escaped = JavaScriptBridge.jsonStringLiteral(event)
                webView?.evaluateJavaScript("window.shell360Native?.onmessage?.({data:\(escaped)});")
            }
        }
        WebContentLoader.load(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "shell360Native")
        webView.navigationDelegate = nil
        coordinator.router.eventHandler = nil
        coordinator.webView = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let router: BridgeRouter
        weak var webView: WKWebView?

        init(router: BridgeRouter) {
            self.router = router
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "shell360Native", let body = message.body as? String else {
                return
            }
            let webView = webView
            Task.detached { [router] in
                let response = router.handle(message: body)
                await MainActor.run {
                    let escaped = JavaScriptBridge.jsonStringLiteral(response)
                    webView?.evaluateJavaScript("window.shell360Native?.onmessage?.({data:\(escaped)});")
                }
            }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if WebContentLoader.isTrusted(url: url) {
                decisionHandler(.allow)
                return
            }

            if ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased()) {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation?, withError error: Error) {
            #if DEBUG
            WebContentLoader.loadBundle(in: webView)
            #endif
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: Error) {
            #if DEBUG
            WebContentLoader.loadBundle(in: webView)
            #endif
        }
    }
}
