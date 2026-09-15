import Foundation
import WebKit

enum AppEnvironment {
    static var isDebug: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }
}

enum WebContentLoader {
    private static let developmentURL = URL(string: "http://127.0.0.1:1421")!

    static func load(in webView: WKWebView) {
        #if DEBUG
        if let url = configuredDevelopmentURL() {
            webView.load(URLRequest(url: url))
            return
        }
        #endif

        loadBundle(in: webView)
    }

    static func loadBundle(in webView: WKWebView) {
        guard Bundle.main.url(forResource: "WebAssets", withExtension: nil) != nil,
              Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets") != nil else {
            webView.loadHTMLString("<h1>Web assets are unavailable.</h1>", baseURL: nil)
            return
        }
        webView.load(URLRequest(url: IosWebAssetsSchemeHandler.indexURL))
    }

    static func isTrusted(url: URL) -> Bool {
        #if DEBUG
        if let configured = configuredDevelopmentURL(), url.host == configured.host, url.port == configured.port {
            return true
        }
        #endif
        return url.scheme == IosWebAssetsSchemeHandler.scheme
            && url.host == IosWebAssetsSchemeHandler.host
    }

    #if DEBUG
    private static func configuredDevelopmentURL() -> URL? {
        if let value = Bundle.main.object(forInfoDictionaryKey: "SHELL360_WEBVIEW_URL") as? String,
           let url = URL(string: value),
           ["http", "https"].contains(url.scheme?.lowercased()) {
            return url
        }
        if let value = ProcessInfo.processInfo.environment["SHELL360_WEBVIEW_URL"],
           let url = URL(string: value),
           ["http", "https"].contains(url.scheme?.lowercased()) {
            return url
        }
        return developmentURL
    }
    #endif
}
