import Foundation
import UIKit

final class BridgeRouter: @unchecked Sendable {
    var rustBridge: RustBridge?
    var eventHandler: (@Sendable (String) -> Void)?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    nonisolated func handle(message: String) -> String {
        guard let data = message.data(using: .utf8) else {
            return encode(.failure(id: nil, error: invalidMessage("Message is not UTF-8.")))
        }

        do {
            let request = try decoder.decode(BridgeRequest.self, from: data)
            guard !request.id.isEmpty, !request.clientId.isEmpty, !request.method.isEmpty else {
                return encode(.failure(id: request.id, error: invalidMessage("id, clientId and method are required.")))
            }

            if request.method == "bridge.health" {
                return encode(.success(id: request.id, result: AnyCodable(["status": "ok"])))
            }

            if request.method == "core.healthCheck" {
                return encode(.success(id: request.id, result: AnyCodable(rustBridge?.healthCheck() ?? "unavailable")))
            }

            if request.method == "bridge.releaseClient" {
                rustBridge?.releaseClient(request.clientId)
                return encode(.success(id: request.id))
            }

            switch request.method {
            case "app.getVersion":
                return encode(.success(id: request.id, result: AnyCodable(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0")))
            case "machineUid.getMachineUid":
                let key = "shell360.machineUid"
                let uid = UserDefaults.standard.string(forKey: key) ?? UUID().uuidString
                UserDefaults.standard.set(uid, forKey: key)
                return encode(.success(id: request.id, result: AnyCodable(uid)))
            case "clipboard.readText":
                return encode(.success(id: request.id, result: AnyCodable(UIPasteboard.general.string ?? "")))
            case "clipboard.writeText":
                guard let params = request.params?.value as? [String: Any], let text = params["text"] as? String else {
                    return encode(.failure(id: request.id, error: invalidMessage("clipboard.writeText requires text.")))
                }
                UIPasteboard.general.string = text
                return encode(.success(id: request.id))
            case "core.openUrl":
                guard let params = request.params?.value as? [String: Any], let rawURL = params["url"] as? String, let url = URL(string: rawURL), ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased()) else {
                    return encode(.failure(id: request.id, error: invalidMessage("core.openUrl requires an allowed URL.")))
                }
                DispatchQueue.main.async { UIApplication.shared.open(url) }
                return encode(.success(id: request.id))
            case "app.setSystemBarsAppearance":
                return encode(.success(id: request.id))
            case "fs.readTextFile":
                guard let params = request.params?.value as? [String: Any], let path = params["path"] as? String else {
                    return encode(.failure(id: request.id, error: invalidMessage("fs.readTextFile requires path.")))
                }
                do {
                    return encode(.success(id: request.id, result: AnyCodable(try String(contentsOfFile: path, encoding: .utf8))))
                } catch {
                    return encode(.failure(id: request.id, error: BridgeErrorPayload(code: "BRIDGE_FS_ERROR", message: "Unable to read text file.", details: nil)))
                }
            case "fs.writeTextFile":
                guard let params = request.params?.value as? [String: Any], let path = params["path"] as? String, let contents = params["contents"] as? String else {
                    return encode(.failure(id: request.id, error: invalidMessage("fs.writeTextFile requires path and contents.")))
                }
                do {
                    try contents.write(toFile: path, atomically: true, encoding: .utf8)
                    return encode(.success(id: request.id))
                } catch {
                    return encode(.failure(id: request.id, error: BridgeErrorPayload(code: "BRIDGE_FS_ERROR", message: "Unable to write text file.", details: nil)))
                }
            default:
                break
            }

            if request.method == "keygen.generate", let rustBridge {
                let params = try encodeParams(request.params)
                return encodeResult(id: request.id, operation: { try rustBridge.invokeKeygen(params: params) })
            }

            if request.method.hasPrefix("data."), let rustBridge {
                let params = try encodeParams(request.params)
                return encodeResult(id: request.id, operation: { try rustBridge.invokeData(method: request.method, params: params) })
            }

            if request.method.hasPrefix("ssh."), let rustBridge {
                let params = try encodeParams(request.params)
                return encodeResult(id: request.id, operation: { try rustBridge.invokeSsh(method: request.method, clientId: request.clientId, params: params) })
            }

            return encode(.failure(id: request.id, error: BridgeErrorPayload(
                code: "BRIDGE_UNSUPPORTED",
                message: "\(request.method) is not implemented by the iOS bridge yet.",
                details: nil
            )))
        } catch {
            return encode(.failure(id: nil, error: invalidMessage("Native bridge message is not valid.")))
        }
    }

    func emit(event: String) {
        eventHandler?(event)
    }

    private nonisolated func invalidMessage(_ message: String) -> BridgeErrorPayload {
        BridgeErrorPayload(code: "BRIDGE_INVALID_MESSAGE", message: message, details: nil)
    }

    private nonisolated func encodeParams(_ params: AnyCodable?) throws -> String {
        let data = try encoder.encode(params ?? AnyCodable(NSNull()))
        guard let value = String(data: data, encoding: .utf8) else {
            throw RustBridgeError.unavailable
        }
        return value
    }

    private nonisolated func encodeResult(id: String, operation: () throws -> String) -> String {
        do {
            let result = try operation()
            guard let data = result.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) else {
                return encode(.success(id: id, result: AnyCodable(result)))
            }
            return encode(.success(id: id, result: AnyCodable(object)))
        } catch RustBridgeError.unavailable {
            return encode(.failure(id: id, error: BridgeErrorPayload(code: "BRIDGE_UNAVAILABLE", message: "Rust runtime is unavailable.", details: nil)))
        } catch {
            return encode(.failure(id: id, error: BridgeErrorPayload(code: "BRIDGE_NATIVE_ERROR", message: "Rust operation failed.", details: nil)))
        }
    }

    private nonisolated func encode(_ response: BridgeResponse) -> String {
        guard let data = try? encoder.encode(response), let value = String(data: data, encoding: .utf8) else {
            return "{\"error\":{\"code\":\"BRIDGE_NATIVE_ERROR\",\"message\":\"Unable to encode response.\"}}"
        }
        return value
    }
}
