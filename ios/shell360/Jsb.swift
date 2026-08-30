import Foundation
import UIKit

struct JsbContext {
    let clientId: String
    let method: String
}

typealias JsbHandler = @Sendable (JsbContext, Any?) async throws -> Any?

final class Jsb: @unchecked Sendable {
    private let registry = NativeJsbRegistry()
    private let lock = NSLock()
    private var handlers: [String: JsbHandler] = [:]
    private var connection: NativeJsbConnection?
    private var clientId: String?
    var closeWindowHandler: (@Sendable () -> Void)?
    var documentPickerHandler: (@Sendable (Bool, Any?) async throws -> Any?)?
    var eventHandler: (@Sendable (String) -> Void)?
    var systemBarsHandler: (@Sendable (Bool) -> Void)?

    func emit(_ event: String) {
        eventHandler?(event)
    }

    func register(_ method: String, callback: @escaping JsbHandler) throws {
        lock.lock()
        defer { lock.unlock() }
        precondition(handlers[method] == nil, "Duplicate JSB method: \(method)")
        try registry.register(method: method)
        handlers[method] = callback
    }

    func connect() {
        close()
        connection = registry.connect()
        clientId = UUID().uuidString
    }

    func dispatch(_ message: String) async -> String {
        guard let connection, let clientId else {
            return errorResponse(message, code: "JSB_NOT_CONNECTED", reason: "JSB is not connected.")
        }
        do {
            guard let request = try JSONSerialization.jsonObject(
                with: Data(message.utf8),
                options: [.fragmentsAllowed]
            ) as? [String: Any],
                  let requestType = request["type"] as? String,
                  requestType == "invoke.request",
                  let requestId = request["id"] as? String,
                  !requestId.isEmpty,
                  let method = request["method"] as? String,
                  !method.isEmpty else {
                return errorResponse(message, code: "JSB_INVALID_MESSAGE", reason: "JSB request is invalid.")
            }
            lock.lock()
            let isRegistered = handlers[method] != nil
            lock.unlock()
            guard isRegistered else {
                return errorResponse(message, code: "JSB_UNSUPPORTED", reason: "JSB handler is unavailable: \(method)")
            }
            let nativeRequest = json([
                "type": "invoke",
                "id": requestId,
                "clientId": clientId,
                "method": method,
                "params": request["data"] ?? NSNull()
            ])
            let call = try connection.dispatch(message: nativeRequest)
            lock.lock()
            let handler = handlers[call.method]
            lock.unlock()
            guard let handler else { preconditionFailure("Registered JSB handler disappeared.") }
            do {
                let params = try JSONSerialization.jsonObject(with: Data(call.paramsJson.utf8), options: [.fragmentsAllowed])
                let result = try await handler(JsbContext(clientId: call.clientId, method: call.method), params is NSNull ? nil : params)
                return response(try connection.resolve(requestId: call.requestId, resultJson: json(result)))
            } catch let error as BridgeCallbackError {
                return response(try connection.reject(
                    requestId: call.requestId,
                    code: error.code,
                    message: error.message,
                    detailsJson: error.details.map(json)
                ))
            } catch {
                return response(try connection.reject(
                    requestId: call.requestId,
                    code: "JSB_NATIVE_ERROR",
                    message: error.localizedDescription,
                    detailsJson: nil
                ))
            }
        } catch {
            return errorResponse(message, code: "JSB_INVALID_MESSAGE", reason: error.localizedDescription)
        }
    }

    func close() {
        if let clientId = connection?.disconnect() {
            handlersReleaseClient?(clientId)
        }
        connection = nil
        clientId = nil
    }

    var handlersReleaseClient: (@Sendable (String) -> Void)?

    private func errorResponse(_ message: String, code: String, reason: String) -> String {
        let id = ((try? JSONSerialization.jsonObject(with: Data(message.utf8))) as? [String: Any])?["id"] as? String ?? ""
        return json(["type": "invoke.response", "id": id, "error": ["code": code, "message": reason]])
    }

    private func response(_ message: String) -> String {
        guard let object = try? JSONSerialization.jsonObject(
            with: Data(message.utf8),
            options: [.fragmentsAllowed]
        ),
              let value = object as? [String: Any],
              let id = value["id"] as? String else {
            return errorResponse(message, code: "JSB_INVALID_RESPONSE", reason: "JSB response is invalid.")
        }
        if let error = value["error"] {
            return json(["type": "invoke.response", "id": id, "error": error])
        }
        return json([
            "type": "invoke.response",
            "id": id,
            "data": value["result"] ?? NSNull()
        ])
    }

    private func json(_ value: Any?) -> String {
        let value = value ?? NSNull()
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]) else {
            return "null"
        }
        return String(data: data, encoding: .utf8) ?? "null"
    }
}

private struct BridgeCallbackError: Error {
    let code: String
    let message: String
    let details: Any?
}

func registerIosRoutes(jsb: Jsb, rustBridge: RustBridge) {
    func jsonParams(_ params: Any?) throws -> String {
        String(data: try JSONSerialization.data(withJSONObject: params ?? NSNull()), encoding: .utf8) ?? "null"
    }

    func data(_ method: String, _ params: Any?) throws -> Any? {
        let value = try JSONSerialization.jsonObject(with: Data(rustBridge.invokeData(method: method, params: try jsonParams(params)).utf8), options: [.fragmentsAllowed])
        return value is NSNull ? nil : value
    }

    func decodeResult(_ value: String) throws -> Any? {
        let result = try JSONSerialization.jsonObject(with: Data(value.utf8), options: [.fragmentsAllowed])
        return result is NSNull ? nil : result
    }

    func localPath(_ value: String) -> String {
        guard let url = URL(string: value), url.isFileURL else { return value }
        return url.path
    }

    func ssh(_ method: String, _ context: JsbContext, _ params: Any?) throws -> Any? {
        let value = try JSONSerialization.jsonObject(with: Data(rustBridge.invokeSsh(method: method, clientId: context.clientId, params: try jsonParams(params)).utf8), options: [.fragmentsAllowed])
        return value is NSNull ? nil : value
    }
    try? jsb.register("bridge.health") { _, _ in ["status": "ok"] }
    try? jsb.register("core.healthCheck") { _, _ in rustBridge.healthCheck() }
    try? jsb.register("app.getVersion") { _, _ in
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }
    try? jsb.register("app.setSystemBarsAppearance") { [weak jsb] _, params in
        guard let dark = (params as? [String: Any])?["dark"] as? Bool else {
            throw BridgeCallbackError(code: "BRIDGE_INVALID_REQUEST", message: "app.setSystemBarsAppearance requires dark.", details: nil)
        }
        jsb?.systemBarsHandler?(dark)
        return nil
    }
    try? jsb.register("machineUid.getMachineUid") { _, _ in
        let key = "shell360.machineUid"
        let value = UserDefaults.standard.string(forKey: key) ?? UUID().uuidString
        UserDefaults.standard.set(value, forKey: key)
        return value
    }
    try? jsb.register("clipboard.readText") { _, _ in UIPasteboard.general.string ?? "" }
    try? jsb.register("clipboard.writeText") { _, params in
        guard let value = params as? [String: Any], let text = value["text"] as? String else { throw BridgeCallbackError(code: "BRIDGE_INVALID_REQUEST", message: "clipboard.writeText requires text.", details: nil) }
        UIPasteboard.general.string = text
        return nil
    }
    try? jsb.register("core.openUrl") { _, params in
        guard let value = params as? [String: Any], let raw = value["url"] as? String, let url = URL(string: raw), ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") else { throw BridgeCallbackError(code: "BRIDGE_INVALID_REQUEST", message: "core.openUrl requires an allowed URL.", details: nil) }
        DispatchQueue.main.async { UIApplication.shared.open(url) }
        return nil
    }
    try? jsb.register("dialog.open") { [weak jsb] _, params in
        guard let handler = jsb?.documentPickerHandler else {
            throw BridgeCallbackError(code: "BRIDGE_UNSUPPORTED", message: "Document picker is unavailable.", details: nil)
        }
        let multiple = (params as? [String: Any])?["multiple"] as? Bool ?? false
        return try await handler(false, multiple)
    }
    try? jsb.register("dialog.save") { [weak jsb] _, params in
        guard let handler = jsb?.documentPickerHandler else {
            throw BridgeCallbackError(code: "BRIDGE_UNSUPPORTED", message: "Document picker is unavailable.", details: nil)
        }
        return try await handler(true, params)
    }
    try? jsb.register("fs.readTextFile") { _, params in
        guard let value = params as? [String: Any], let path = value["path"] as? String else { throw BridgeCallbackError(code: "BRIDGE_INVALID_REQUEST", message: "fs.readTextFile requires path.", details: nil) }
        return try String(contentsOfFile: localPath(path), encoding: .utf8)
    }
    try? jsb.register("fs.writeTextFile") { _, params in
        guard let value = params as? [String: Any], let path = value["path"] as? String, let contents = value["contents"] as? String else { throw BridgeCallbackError(code: "BRIDGE_INVALID_REQUEST", message: "fs.writeTextFile requires path and contents.", details: nil) }
        try contents.write(toFile: localPath(path), atomically: true, encoding: .utf8)
        return nil
    }
    try? jsb.register("window.close") { [weak jsb] _, _ in
        jsb?.closeWindowHandler?()
        return nil
    }
    try? jsb.register("keygen.generate") { _, params in
        try decodeResult(rustBridge.invokeKeygen(params: try jsonParams(params)))
    }
    try? jsb.register("data.checkIsEnableCrypto") { context, params in try data("data.checkIsEnableCrypto", params) }
    try? jsb.register("data.checkIsInitCrypto") { context, params in try data("data.checkIsInitCrypto", params) }
    try? jsb.register("data.checkIsAuthed") { context, params in try data("data.checkIsAuthed", params) }
    try? jsb.register("data.initCryptoKey") { context, params in try data("data.initCryptoKey", params) }
    try? jsb.register("data.initCryptoPassword") { context, params in try data("data.initCryptoPassword", params) }
    try? jsb.register("data.loadCryptoByPassword") { context, params in try data("data.loadCryptoByPassword", params) }
    try? jsb.register("data.initCryptoBiometric") { context, params in try data("data.initCryptoBiometric", params) }
    try? jsb.register("data.loadCryptoByBiometric") { context, params in try data("data.loadCryptoByBiometric", params) }
    try? jsb.register("data.changeCryptoPassword") { context, params in try data("data.changeCryptoPassword", params) }
    try? jsb.register("data.changeCryptoEnable") { context, params in try data("data.changeCryptoEnable", params) }
    try? jsb.register("data.resetCrypto") { context, params in try data("data.resetCrypto", params) }
    try? jsb.register("data.rotateCryptoKey") { context, params in try data("data.rotateCryptoKey", params) }
    try? jsb.register("data.getHosts") { context, params in try data("data.getHosts", params) }
    try? jsb.register("data.addHost") { context, params in try data("data.addHost", params) }
    try? jsb.register("data.updateHost") { context, params in try data("data.updateHost", params) }
    try? jsb.register("data.deleteHost") { context, params in try data("data.deleteHost", params) }
    try? jsb.register("data.getKeys") { context, params in try data("data.getKeys", params) }
    try? jsb.register("data.addKey") { context, params in try data("data.addKey", params) }
    try? jsb.register("data.updateKey") { context, params in try data("data.updateKey", params) }
    try? jsb.register("data.deleteKey") { context, params in try data("data.deleteKey", params) }
    try? jsb.register("data.getPortForwardings") { context, params in try data("data.getPortForwardings", params) }
    try? jsb.register("data.addPortForwarding") { context, params in try data("data.addPortForwarding", params) }
    try? jsb.register("data.updatePortForwarding") { context, params in try data("data.updatePortForwarding", params) }
    try? jsb.register("data.deletePortForwarding") { context, params in try data("data.deletePortForwarding", params) }
    try? jsb.register("ssh.session.connect") { context, params in try ssh("ssh.session.connect", context, params) }
    try? jsb.register("ssh.session.authenticatePassword") { context, params in try ssh("ssh.session.authenticatePassword", context, params) }
    try? jsb.register("ssh.session.authenticatePublicKey") { context, params in try ssh("ssh.session.authenticatePublicKey", context, params) }
    try? jsb.register("ssh.session.authenticateCertificate") { context, params in try ssh("ssh.session.authenticateCertificate", context, params) }
    try? jsb.register("ssh.session.authenticateKeyboardInteractive") { context, params in try ssh("ssh.session.authenticateKeyboardInteractive", context, params) }
    try? jsb.register("ssh.session.authenticateAgent") { context, params in try ssh("ssh.session.authenticateAgent", context, params) }
    try? jsb.register("ssh.session.disconnect") { context, params in try ssh("ssh.session.disconnect", context, params) }
    try? jsb.register("ssh.shell.open") { context, params in try ssh("ssh.shell.open", context, params) }
    try? jsb.register("ssh.shell.send") { context, params in try ssh("ssh.shell.send", context, params) }
    try? jsb.register("ssh.shell.resize") { context, params in try ssh("ssh.shell.resize", context, params) }
    try? jsb.register("ssh.shell.close") { context, params in try ssh("ssh.shell.close", context, params) }
    try? jsb.register("ssh.sftp.open") { context, params in try ssh("ssh.sftp.open", context, params) }
    try? jsb.register("ssh.sftp.close") { context, params in try ssh("ssh.sftp.close", context, params) }
    try? jsb.register("ssh.sftp.readDir") { context, params in try ssh("ssh.sftp.readDir", context, params) }
    try? jsb.register("ssh.sftp.createFile") { context, params in try ssh("ssh.sftp.createFile", context, params) }
    try? jsb.register("ssh.sftp.createDir") { context, params in try ssh("ssh.sftp.createDir", context, params) }
    try? jsb.register("ssh.sftp.removeFile") { context, params in try ssh("ssh.sftp.removeFile", context, params) }
    try? jsb.register("ssh.sftp.removeDir") { context, params in try ssh("ssh.sftp.removeDir", context, params) }
    try? jsb.register("ssh.sftp.rename") { context, params in try ssh("ssh.sftp.rename", context, params) }
    try? jsb.register("ssh.sftp.exists") { context, params in try ssh("ssh.sftp.exists", context, params) }
    try? jsb.register("ssh.sftp.canonicalize") { context, params in try ssh("ssh.sftp.canonicalize", context, params) }
    try? jsb.register("ssh.sftp.readTextFile") { context, params in try ssh("ssh.sftp.readTextFile", context, params) }
    try? jsb.register("ssh.sftp.writeTextFile") { context, params in try ssh("ssh.sftp.writeTextFile", context, params) }
    try? jsb.register("ssh.sftp.uploadFile") { context, params in try ssh("ssh.sftp.uploadFile", context, params) }
    try? jsb.register("ssh.sftp.downloadFile") { context, params in try ssh("ssh.sftp.downloadFile", context, params) }
    try? jsb.register("ssh.portForwarding.openLocal") { context, params in try ssh("ssh.portForwarding.openLocal", context, params) }
    try? jsb.register("ssh.portForwarding.closeLocal") { context, params in try ssh("ssh.portForwarding.closeLocal", context, params) }
    try? jsb.register("ssh.portForwarding.openRemote") { context, params in try ssh("ssh.portForwarding.openRemote", context, params) }
    try? jsb.register("ssh.portForwarding.closeRemote") { context, params in try ssh("ssh.portForwarding.closeRemote", context, params) }
    try? jsb.register("ssh.portForwarding.openDynamic") { context, params in try ssh("ssh.portForwarding.openDynamic", context, params) }
    try? jsb.register("ssh.portForwarding.closeDynamic") { context, params in try ssh("ssh.portForwarding.closeDynamic", context, params) }
}
