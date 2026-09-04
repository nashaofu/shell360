import Darwin
import SwiftUI
import UIKit
import WebKit
import UniformTypeIdentifiers

struct WebViewContainer: UIViewRepresentable {
    let rustBridge: RustBridge

    func makeCoordinator() -> Coordinator {
        Coordinator(rustBridge: rustBridge)
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
        context.coordinator.attach(to: webView)
        WebContentLoader.load(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "shell360Native")
        webView.navigationDelegate = nil
        coordinator.detach()
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, UIDocumentPickerDelegate {
        private let rustBridge: RustBridge
        private weak var webView: WKWebView?
        private var jsb: NativeJsb?
        private var transport: IosJsbTransport?
        private var hostServices: IosHostServices?
        private var openChannels: Set<String> = []
        private var pickerContinuation: CheckedContinuation<Any?, Error>?
        private var pickerSourceURL: URL?

        init(rustBridge: RustBridge) {
            self.rustBridge = rustBridge
        }

        func attach(to webView: WKWebView) {
            self.webView = webView
            let rustBridge = self.rustBridge

            let transport = IosJsbTransport(webView: webView)
            self.transport = transport

            let hostServices = IosHostServices(
                closeWindow: { [weak webView] in
                    DispatchQueue.main.async {
                        webView?.window?.rootViewController?.dismiss(animated: true)
                    }
                },
                resetApplication: {
                    rustBridge.shutdown()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                        exit(0)
                    }
                },
                setSystemBarsAppearance: { [weak webView] dark in
                    DispatchQueue.main.async {
                        webView?.window?.overrideUserInterfaceStyle = dark ? .dark : .light
                        webView?.window?.rootViewController?.setNeedsStatusBarAppearanceUpdate()
                    }
                },
                documentPicker: { [weak self] save, params in
                    guard let self else { return NSNull() }
                    return try await self.pickDocument(save: save, params: params)
                }
            )
            self.hostServices = hostServices

            guard let jsb = rustBridge.createJsb(transport: transport, hostServices: hostServices) else {
                return
            }
            self.jsb = jsb

            hostServices.attachCompletion { [weak self] callId, resultJson in
                Task { @MainActor [weak self] in
                    self?.jsb?.completeHostCall(callId: callId, resultJson: resultJson)
                }
            }

        }

        func detach() {
            hostServices?.detachCompletion()
            try? jsb?.shutdown()
            jsb = nil
            transport?.detach()
            transport = nil
            hostServices = nil
            webView = nil
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

            switch kind {
            case "channel.open":
                openChannels.insert(channelId)
                try? jsb?.openChannel(channelId: channelId)
            case "channel.close":
                openChannels.remove(channelId)
                try? jsb?.closeChannel(channelId: channelId)
            case "text":
                try? jsb?.receiveText(channelId: channelId, text: payload)
            case "binary":
                guard let data = Data(base64Encoded: payload) else { return }
                try? jsb?.receiveBinary(channelId: channelId, bytes: data)
            default:
                break
            }
        }

        func pickDocument(save: Bool, params: Any?) async throws -> Any? {
            guard pickerContinuation == nil else {
                throw NativeBridgeError(code: "BRIDGE_BUSY", message: "A document picker is already open.")
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
            for channelId in openChannels {
                try? jsb?.closeChannel(channelId: channelId)
            }
            openChannels.removeAll()
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

/// WKWebView transport adapter for the Rust JSB core. The callbacks are
/// invoked on Rust worker threads and every one hops to the main queue before
/// touching WebKit, which keeps per-channel frame ordering stable. The
/// document-start JS adapter creates its own MessageChannel and posts
/// `channel.opened` with port2 itself, so `openChannel` is a no-op. Base64 for
/// binary frames is confined to this WKScriptMessage transport adapter.
final class IosJsbTransport: JsbTransport, @unchecked Sendable {
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    func detach() {
        DispatchQueue.main.async { [weak self] in
            self?.webView = nil
        }
    }

    func openChannel(channelId: String, controlMessage: String) {
        // No-op: the JS adapter owns MessageChannel creation on iOS.
    }

    func failChannel(channelId: String, controlMessage: String) {
        DispatchQueue.main.async { [weak self] in
            self?.postControl(controlMessage)
        }
    }

    func sendText(channelId: String, message: String) {
        DispatchQueue.main.async { [weak self] in
            self?.receiveText(channelId: channelId, text: message)
        }
    }

    func sendBinary(channelId: String, data: Data) {
        DispatchQueue.main.async { [weak self] in
            self?.receiveBinary(channelId: channelId, bytes: data)
        }
    }

    func closeChannel(channelId: String) {
        DispatchQueue.main.async { [weak self] in
            self?.receiveClose(channelId: channelId)
        }
    }

    private func receiveText(channelId: String, text: String) {
        let envelope = JavaScriptBridge.jsonObjectLiteral([
            "version": 1,
            "kind": "text",
            "channelId": channelId,
            "payload": text
        ])
        webView?.evaluateJavaScript("window.__JSB__?.receive?.(\(envelope));")
    }

    private func receiveBinary(channelId: String, bytes: Data) {
        let envelope = JavaScriptBridge.jsonObjectLiteral([
            "version": 1,
            "kind": "binary",
            "channelId": channelId,
            "payload": bytes.base64EncodedString()
        ])
        webView?.evaluateJavaScript("window.__JSB__?.receive?.(\(envelope));")
    }

    private func receiveClose(channelId: String) {
        postControl(JavaScriptBridge.jsonObjectLiteral([
            "source": "jsb.channel",
            "type": "channel.closed",
            "channelId": channelId
        ]))
        let envelope = JavaScriptBridge.jsonObjectLiteral([
            "version": 1,
            "kind": "close",
            "channelId": channelId,
            "payload": ""
        ])
        webView?.evaluateJavaScript("window.__JSB__?.receive?.(\(envelope));")
    }

    private func postControl(_ text: String) {
        let escaped = JavaScriptBridge.jsonStringLiteral(text)
        webView?.evaluateJavaScript("window.postMessage(\(escaped), window.location.origin);")
    }
}
