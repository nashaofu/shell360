import SwiftUI
import UIKit
import WebKit
import UniformTypeIdentifiers

struct WebViewContainer: UIViewRepresentable {
    let router: BridgeRouter
    let jsb: Jsb

    func makeCoordinator() -> Coordinator {
        Coordinator(router: router, jsb: jsb)
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
        jsb.closeWindowHandler = { [weak webView] in
            DispatchQueue.main.async {
                webView?.window?.rootViewController?.dismiss(animated: true)
            }
        }
        jsb.documentPickerHandler = { [weak coordinator = context.coordinator] save, params in
            try await coordinator?.pickDocument(save: save, params: params) ?? NSNull()
        }
        jsb.systemBarsHandler = { [weak webView] dark in
            DispatchQueue.main.async {
                webView?.window?.overrideUserInterfaceStyle = dark ? .dark : .light
                webView?.window?.rootViewController?.setNeedsStatusBarAppearanceUpdate()
            }
        }
        jsb.connect()
        router.eventHandler = { [weak webView] event in
            DispatchQueue.main.async {
                let escaped = JavaScriptBridge.jsonStringLiteral(event)
                webView?.evaluateJavaScript("window.__JSB__?.emit?.(\(escaped));")
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
        coordinator.jsb.closeWindowHandler = nil
        coordinator.jsb.documentPickerHandler = nil
        coordinator.jsb.systemBarsHandler = nil
        coordinator.jsb.close()
        coordinator.webView = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, UIDocumentPickerDelegate {
        let router: BridgeRouter
        let jsb: Jsb
        weak var webView: WKWebView?
        private var pickerContinuation: CheckedContinuation<Any?, Error>?
        private var pickerSourceURL: URL?

        init(router: BridgeRouter, jsb: Jsb) {
            self.router = router
            self.jsb = jsb
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "shell360Native",
                  let body = message.body as? [String: Any],
                  let channelId = body["channelId"] as? String,
                  let request = body["message"] as? String else {
                return
            }
            let webView = webView
            Task.detached { [jsb] in
                let response = await jsb.dispatch(request)
                await MainActor.run {
                    let escapedChannelId = JavaScriptBridge.jsonStringLiteral(channelId)
                    let escaped = JavaScriptBridge.jsonStringLiteral(response)
                    webView?.evaluateJavaScript("window.__JSB__?.receive?.(\(escapedChannelId), \(escaped));")
                }
            }
        }

        func pickDocument(save: Bool, params: Any?) async throws -> Any? {
            guard pickerContinuation == nil else {
                throw BridgeCallbackError(code: "BRIDGE_BUSY", message: "A document picker is already open.", details: nil)
            }
            return try await withCheckedThrowingContinuation { continuation in
                pickerContinuation = continuation
                let controller: UIDocumentPickerViewController
                if save {
                    let requestedName = (params as? [String: Any])?["defaultPath"] as? String
                    let filename = requestedName.map { URL(fileURLWithPath: $0).lastPathComponent } ?? "shell360-export"
                    let sourceURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
                    FileManager.default.createFile(atPath: sourceURL.path, contents: Data())
                    pickerSourceURL = sourceURL
                    controller = UIDocumentPickerViewController(forExporting: [sourceURL], asCopy: true)
                    controller.modalPresentationStyle = .formSheet
                    controller.title = filename
                } else {
                    let types: [UTType] = [.item]
                    controller = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
                    controller.allowsMultipleSelection = (params as? [String: Any])?["multiple"] as? Bool ?? false
                }
                controller.delegate = self
                webView?.window?.rootViewController?.present(controller, animated: true)
            }
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            let result: Any? = controller.documentPickerMode == .open
                ? (controller.allowsMultipleSelection ? urls.map(\.absoluteString) : urls.first?.absoluteString)
                : urls.first?.absoluteString
            pickerContinuation?.resume(returning: result)
            pickerContinuation = nil
            if let sourceURL = pickerSourceURL {
                try? FileManager.default.removeItem(at: sourceURL)
                pickerSourceURL = nil
            }
        }

        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            pickerContinuation?.resume(returning: nil)
            pickerContinuation = nil
            if let sourceURL = pickerSourceURL {
                try? FileManager.default.removeItem(at: sourceURL)
                pickerSourceURL = nil
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
            jsb.connect()
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
