import Foundation
import UIKit

struct NativeBridgeError: Error {
    let code: String
    let message: String
    let details: Any?
}

final class IosHostServices: HostServices, @unchecked Sendable {
    private let closeWindow: @Sendable () -> Void
    private let resetApplication: @Sendable () -> Void
    private let setSystemBarsAppearance: @Sendable (Bool) -> Void
    private let documentPicker: @Sendable (Bool, Any?) async throws -> Any?
    private let lock = NSLock()
    private var completion: ((String, String) -> Void)?

    init(
        closeWindow: @escaping @Sendable () -> Void,
        resetApplication: @escaping @Sendable () -> Void,
        setSystemBarsAppearance: @escaping @Sendable (Bool) -> Void,
        documentPicker: @escaping @Sendable (Bool, Any?) async throws -> Any?
    ) {
        self.closeWindow = closeWindow
        self.resetApplication = resetApplication
        self.setSystemBarsAppearance = setSystemBarsAppearance
        self.documentPicker = documentPicker
    }

    func attachCompletion(_ completion: @escaping (String, String) -> Void) {
        withLock { self.completion = completion }
    }

    func detachCompletion() {
        withLock { completion = nil }
    }

    func onHostCall(callId: String, primitive: String, paramsJson: String) {
        Task {
            let result: String
            do {
                let params = try Self.parseParams(paramsJson)
                result = Self.success(try await execute(primitive: primitive, params: params))
            } catch let error as NativeBridgeError {
                result = Self.failure(code: error.code, message: error.message, details: error.details)
            } catch {
                result = Self.failure(code: "JSB_NATIVE_ERROR", message: error.localizedDescription)
            }
            let completion = withLock { self.completion }
            completion?(callId, result)
        }
    }

    private func execute(primitive: String, params: [String: Any]) async throws -> Any? {
        switch primitive {
        case "setSystemBarsAppearance":
            let dark = try Self.requireBool(params, "dark")
            await MainActor.run { setSystemBarsAppearance(dark) }
            return nil
        case "readClipboard":
            return await MainActor.run { UIPasteboard.general.string ?? "" }
        case "writeClipboard":
            let text = try Self.requireString(params, "text")
            await MainActor.run { UIPasteboard.general.string = text }
            return nil
        case "openExternal":
            let url = try Self.requireUrl(params, "url")
            DispatchQueue.main.async { UIApplication.shared.open(url) }
            return nil
        case "pickDocuments":
            return try await documentPicker(false, params)
        case "saveDocument":
            return try await documentPicker(true, params)
        case "readTextFile":
            return try Self.readTextFile(params)
        case "writeTextFile":
            try Self.writeTextFile(params)
            return nil
        case "closeWindow":
            closeWindow()
            return nil
        case "readScopedFile":
            try Self.readScopedFile(params)
            return nil
        case "writeScopedFile":
            try Self.writeScopedFile(params)
            return nil
        case "resetApplication":
            resetApplication()
            return nil
        default:
            throw NativeBridgeError(
                code: "BRIDGE_UNSUPPORTED",
                message: "iOS HostServices primitive is unavailable: \(primitive)"
            )
        }
    }

    private static func readTextFile(_ params: [String: Any]) throws -> String {
        let path = try requireString(params, "path")
        return try String(contentsOfFile: localPath(path), encoding: .utf8)
    }

    private static func writeTextFile(_ params: [String: Any]) throws {
        let path = try requireString(params, "path")
        let contents = try requireString(params, "contents")
        try contents.write(toFile: localPath(path), atomically: true, encoding: .utf8)
    }

    private static func readScopedFile(_ params: [String: Any]) throws {
        let source = try fileUrl(try requireString(params, "source"), "source")
        let target = URL(fileURLWithPath: try requireString(params, "targetPath"))
        try FileManager.default.copyItem(at: source, to: target)
    }

    private static func writeScopedFile(_ params: [String: Any]) throws {
        let source = URL(fileURLWithPath: try requireString(params, "sourcePath"))
        let target = try fileUrl(try requireString(params, "target"), "target")
        if FileManager.default.fileExists(atPath: target.path) {
            try FileManager.default.removeItem(at: target)
        }
        try FileManager.default.copyItem(at: source, to: target)
    }

    private static func localPath(_ value: String) -> String {
        guard let url = URL(string: value), url.isFileURL else { return value }
        return url.path
    }

    private static func fileUrl(_ value: String, _ name: String) throws -> URL {
        guard let url = URL(string: value), url.isFileURL else {
            throw NativeBridgeError(code: "BRIDGE_INVALID_REQUEST", message: "\(name) must be a file URL.")
        }
        return url
    }

    private static func requireString(_ params: [String: Any], _ name: String) throws -> String {
        guard let value = params[name] as? String else {
            throw NativeBridgeError(code: "BRIDGE_INVALID_REQUEST", message: "\(name) must be a string.")
        }
        return value
    }

    private static func requireBool(_ params: [String: Any], _ name: String) throws -> Bool {
        guard let value = params[name] as? Bool else {
            throw NativeBridgeError(code: "BRIDGE_INVALID_REQUEST", message: "\(name) must be a boolean.")
        }
        return value
    }

    private static func requireUrl(_ params: [String: Any], _ name: String) throws -> URL {
        let raw = try requireString(params, name)
        guard let url = URL(string: raw),
              ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") else {
            throw NativeBridgeError(code: "BRIDGE_INVALID_REQUEST", message: "\(name) must be an allowed URL.")
        }
        return url
    }

    private static func parseParams(_ json: String) throws -> [String: Any] {
        guard let data = json.data(using: .utf8),
              let value = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) else {
            return [:]
        }
        return value as? [String: Any] ?? [:]
    }

    private static func success(_ data: Any?) -> String {
        let object: [String: Any] = ["data": data ?? NSNull()]
        guard let encoded = try? JSONSerialization.data(withJSONObject: object, options: [.fragmentsAllowed]),
              let string = String(data: encoded, encoding: .utf8) else {
            return "{\"data\":null}"
        }
        return string
    }

    private static func failure(code: String, message: String, details: Any? = nil) -> String {
        var error: [String: Any] = ["code": code, "message": message]
        if let details {
            error["details"] = details
        }
        let object: [String: Any] = ["error": error]
        guard let encoded = try? JSONSerialization.data(withJSONObject: object, options: [.fragmentsAllowed]),
              let string = String(data: encoded, encoding: .utf8) else {
            return "{\"error\":{\"code\":\"\(code)\",\"message\":\"\(message)\"}}"
        }
        return string
    }

    private func withLock<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }
}
