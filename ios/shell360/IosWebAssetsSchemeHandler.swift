import Foundation
import UniformTypeIdentifiers
import WebKit

final class IosWebAssetsSchemeHandler: NSObject, WKURLSchemeHandler, @unchecked Sendable {
    static let scheme = "shell360-app"
    static let host = "localhost"
    static let indexURL = URL(string: "\(scheme)://\(host)/index.html")!

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard urlSchemeTask.request.httpMethod?.uppercased() == "GET" else {
            respond(to: urlSchemeTask, status: 405)
            return
        }
        guard let fileURL = Self.resolve(urlSchemeTask.request.url) else {
            respond(to: urlSchemeTask, status: 404)
            return
        }

        do {
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            respond(
                to: urlSchemeTask,
                status: 200,
                contentType: Self.contentType(for: fileURL),
                data: data
            )
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func resolve(_ requestURL: URL?) -> URL? {
        guard let requestURL,
              requestURL.scheme == scheme,
              requestURL.host == host,
              let root = Bundle.main.url(forResource: "WebAssets", withExtension: nil),
              let decodedPath = requestURL.path.removingPercentEncoding,
              !decodedPath.contains("\0") else {
            return nil
        }

        let relativePath = decodedPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !relativePath.isEmpty else { return nil }

        let normalizedRoot = root.resolvingSymlinksInPath().standardizedFileURL
        let candidate = normalizedRoot
            .appendingPathComponent(relativePath)
            .resolvingSymlinksInPath()
            .standardizedFileURL
        guard candidate.path.hasPrefix(normalizedRoot.path + "/"),
              !candidate.hasDirectoryPath,
              FileManager.default.fileExists(atPath: candidate.path) else {
            return nil
        }
        return candidate
    }

    private static func contentType(for url: URL) -> String {
        UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    }

    private func respond(
        to task: WKURLSchemeTask,
        status: Int,
        contentType: String = "text/plain; charset=utf-8",
        data: Data? = nil
    ) {
        guard let url = task.request.url,
              let response = HTTPURLResponse(
                  url: url,
                  statusCode: status,
                  httpVersion: "HTTP/1.1",
                  headerFields: [
                      "Cache-Control": "no-cache",
                      "Content-Length": String(data?.count ?? 0),
                      "Content-Type": contentType
                  ]
              ) else {
            task.didFailWithError(URLError(.badServerResponse))
            return
        }
        task.didReceive(response)
        if let data {
            task.didReceive(data)
        }
        task.didFinish()
    }
}
