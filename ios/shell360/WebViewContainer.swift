import SwiftUI
import UIKit
import WebKit
import UniformTypeIdentifiers

struct WebViewContainer: UIViewRepresentable {
    let jsb: Jsb

    func makeCoordinator() -> Coordinator {
        Coordinator(jsb: jsb)
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
        jsb.eventHandler = { [weak webView] event in
            DispatchQueue.main.async {
                let escaped = JavaScriptBridge.jsonStringLiteral(event)
                webView?.evaluateJavaScript("window.__JSB__?.emit?.(\(escaped));")
            }
        }
        jsb.sshShellEventHandler = { [weak coordinator = context.coordinator] clientId, sshShellId, data in
            DispatchQueue.main.async {
                coordinator?.receiveSshShellData(clientId: clientId, sshShellId: sshShellId, data: data)
            }
        }
        WebContentLoader.load(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "shell360Native")
        webView.navigationDelegate = nil
        coordinator.jsb.eventHandler = nil
        coordinator.jsb.sshShellEventHandler = nil
        coordinator.jsb.closeWindowHandler = nil
        coordinator.jsb.documentPickerHandler = nil
        coordinator.jsb.systemBarsHandler = nil
        coordinator.jsb.close()
        coordinator.webView = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, UIDocumentPickerDelegate {
        let jsb: Jsb
        weak var webView: WKWebView?
        private var pickerContinuation: CheckedContinuation<Any?, Error>?
        private var pickerSourceURL: URL?
        private var shellBindings: [String: (clientId: String, sshShellId: String)] = [:]

        init(jsb: Jsb) {
            self.jsb = jsb
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "shell360Native",
                  let body = message.body as? [String: Any],
                  body["version"] as? Int == 1,
                  let kind = body["kind"] as? String,
                  let channelId = body["channelId"] as? String,
                  let payload = body["payload"] as? String else {
                return
            }
            if kind == "channel.close" {
                shellBindings.removeValue(forKey: channelId)
                return
            }
            if kind == "binary" {
                guard let binding = shellBindings[channelId],
                      let data = Data(base64Encoded: payload) else {
                    return
                }
                Task.detached { [jsb] in
                    try? jsb.sendSshShellData(
                        clientId: binding.clientId,
                        sshShellId: binding.sshShellId,
                        data: data
                    )
                }
                return
            }
            guard kind == "text" else { return }
            bindShellChannel(request: payload)
            let webView = webView
            Task.detached { [jsb] in
                let response = await jsb.dispatch(payload)
                await MainActor.run {
                    let envelope = JavaScriptBridge.jsonObjectLiteral([
                        "version": 1,
                        "kind": "text",
                        "channelId": channelId,
                        "payload": response
                    ])
                    webView?.evaluateJavaScript("window.__JSB__?.receive?.(\(envelope));")
                }
            }
        }

        func receiveSshShellData(clientId: String, sshShellId: String, data: Data) {
            guard let channelId = shellBindings.first(where: {
                $0.value.clientId == clientId && $0.value.sshShellId == sshShellId
            })?.key else {
                return
            }
            let envelope = JavaScriptBridge.jsonObjectLiteral([
                "version": 1,
                "kind": "binary",
                "channelId": channelId,
                "payload": data.base64EncodedString()
            ])
            webView?.evaluateJavaScript("window.__JSB__?.receive?.(\(envelope));")
        }

        private func bindShellChannel(request: String) {
            guard let data = request.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  object["method"] as? String == "ssh.shell.open",
                  let params = object["data"] as? [String: Any],
                  let dataChannelId = params["dataChannelId"] as? String,
                  let sshShellId = params["sshShellId"] as? String,
                  let clientId = jsb.currentClientId() else {
                return
            }
            shellBindings[dataChannelId] = (clientId, sshShellId)
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
            shellBindings.removeAll()
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
