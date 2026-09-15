import Foundation
import WebKit

final class IosBinarySchemeHandler: NSObject, WKURLSchemeHandler, @unchecked Sendable {
    static let scheme = "shell360-binary"

    private enum BodyError: Error {
        case unreadable
        case tooLarge
    }

    private let store: IosBinaryChannelStore
    private let lock = NSLock()
    private var jsb: NativeJsb?
    private var stoppedTasks = Set<ObjectIdentifier>()

    init(store: IosBinaryChannelStore) {
        self.store = store
    }

    func attach(jsb: NativeJsb) {
        withLock {
            self.jsb = jsb
        }
    }

    func detach() {
        withLock {
            jsb = nil
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let request = urlSchemeTask.request
        guard let route = Self.route(request.url) else {
            respond(urlSchemeTask, status: 404)
            return
        }

        switch request.httpMethod?.uppercased() {
        case "OPTIONS":
            respond(urlSchemeTask, status: 204)
        case "POST" where route.action == "send":
            receive(request, channelId: route.channelId, task: urlSchemeTask)
        case "GET" where route.action == "receive":
            send(channelId: route.channelId, task: urlSchemeTask)
        default:
            respond(urlSchemeTask, status: 405)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        _ = withLock { stoppedTasks.insert(ObjectIdentifier(urlSchemeTask)) }
    }

    private func receive(_ request: URLRequest, channelId: String, task: WKURLSchemeTask) {
        guard request.value(forHTTPHeaderField: "Content-Type")?.lowercased().hasPrefix("application/octet-stream") == true else {
            respond(task, status: 415)
            return
        }
        let data: Data
        do {
            data = try Self.readBody(request)
        } catch {
            respond(task, status: 413)
            return
        }
        guard data.count <= IosBinaryChannelStore.maxFrameSize else {
            respond(task, status: 413)
            return
        }
        guard let jsb = withLock({ self.jsb }) else {
            respond(task, status: 503)
            return
        }

        do {
            try jsb.receiveBinary(channelId: channelId, bytes: data)
            respond(task, status: 204)
        } catch {
            respond(task, status: 500)
        }
    }

    private func send(channelId: String, task: WKURLSchemeTask) {
        switch store.dequeue(channelId: channelId) {
        case let .frame(data):
            respond(task, status: 200, data: data)
        case .empty:
            respond(task, status: 204)
        case .closed:
            respond(task, status: 404)
        }
    }

    private func respond(_ task: WKURLSchemeTask, status: Int, data: Data? = nil) {
        guard !withLock({ stoppedTasks.contains(ObjectIdentifier(task)) }) else { return }
        guard let url = task.request.url,
              let response = HTTPURLResponse(
                  url: url,
                  statusCode: status,
                  httpVersion: "HTTP/1.1",
                  headerFields: [
                      "Access-Control-Allow-Headers": "Content-Type",
                      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                      "Access-Control-Allow-Origin": "*",
                      "Cache-Control": "no-store",
                      "Content-Type": "application/octet-stream"
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
        _ = withLock { stoppedTasks.remove(ObjectIdentifier(task)) }
    }

    private static func route(_ url: URL?) -> (channelId: String, action: String)? {
        guard let url,
              url.scheme == scheme,
              url.host == "channel" else {
            return nil
        }
        let components = url.pathComponents.filter { $0 != "/" }
        guard components.count == 3,
              components[0] == "v1",
              let channelId = components[1].removingPercentEncoding,
              !channelId.isEmpty,
              !channelId.contains("/"),
              ["send", "receive"].contains(components[2]) else {
            return nil
        }
        return (channelId, components[2])
    }

    private static func readBody(_ request: URLRequest) throws -> Data {
        if let body = request.httpBody {
            return body
        }
        guard let stream = request.httpBodyStream else {
            return Data()
        }

        stream.open()
        defer { stream.close() }

        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 64 * 1024)
        while true {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count < 0 {
                throw BodyError.unreadable
            }
            if count == 0 {
                break
            }
            data.append(contentsOf: buffer.prefix(count))
            if data.count > IosBinaryChannelStore.maxFrameSize {
                throw BodyError.tooLarge
            }
        }
        return data
    }

    private func withLock<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }
}
