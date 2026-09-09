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
        guard let root = Bundle.main.url(forResource: "WebAssets", withExtension: nil),
              let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets") else {
            webView.loadHTMLString("<h1>Web assets are unavailable.</h1>", baseURL: nil)
            return
        }
        webView.loadFileURL(index, allowingReadAccessTo: root)
    }

    static func isTrusted(url: URL) -> Bool {
        #if DEBUG
        if let configured = configuredDevelopmentURL(), url.host == configured.host, url.port == configured.port {
            return true
        }
        #endif
        guard let root = Bundle.main.url(forResource: "WebAssets", withExtension: nil) else {
            return false
        }
        guard url.isFileURL else { return false }
        let rootPath = root.resolvingSymlinksInPath().standardizedFileURL.path
        let filePath = url.resolvingSymlinksInPath().standardizedFileURL.path
        return filePath == rootPath || filePath.hasPrefix(rootPath + "/")
    }

    #if DEBUG
    private static func configuredDevelopmentURL() -> URL? {
        if let value = Bundle.main.object(forInfoDictionaryKey: "SHELL360_WEBVIEW_URL") as? String,
           let url = URL(string: value),
           ["http", "https"].contains(url.scheme?.lowercased()) {
            return url
        }
        return developmentURL
    }
    #endif
}
