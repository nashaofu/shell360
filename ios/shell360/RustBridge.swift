import Foundation

final class RustBridge: @unchecked Sendable {
    private let runtime: Shell360Runtime?

    init(onEvent: @escaping @Sendable (String) -> Void = { _ in }) {
        let fileManager = FileManager.default
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        let appData = appSupport.appendingPathComponent("shell360", isDirectory: true)
        let cache = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
            .appendingPathComponent("shell360", isDirectory: true)
        try? fileManager.createDirectory(at: appData, withIntermediateDirectories: true)
        try? fileManager.createDirectory(at: cache, withIntermediateDirectories: true)

        runtime = try? Shell360Runtime(
            appDataDir: appData.path,
            cacheDir: cache.path,
            eventSink: RustEventSink(onEvent: onEvent)
        )
    }

    func healthCheck() -> String {
        runtime?.healthCheck() ?? "unavailable"
    }

    func invokeKeygen(params: String) throws -> String {
        guard let runtime else { throw RustBridgeError.unavailable }
        return try runtime.invokeKeygen(paramsJson: params)
    }

    func invokeData(method: String, params: String) throws -> String {
        guard let runtime else { throw RustBridgeError.unavailable }
        return try runtime.invokeData(method: method, paramsJson: params)
    }

    func invokeSsh(method: String, clientId: String, params: String) throws -> String {
        guard let runtime else { throw RustBridgeError.unavailable }
        return try runtime.invokeSsh(method: method, clientId: clientId, paramsJson: params)
    }

    func releaseClient(_ clientId: String) {
        runtime?.releaseClient(clientId: clientId)
    }

    func shutdown() {
        runtime?.shutdown()
    }
}

enum RustBridgeError: Error {
    case unavailable
}

final class RustEventSink: FfiEventSink, @unchecked Sendable {
    private let onEvent: @Sendable (String) -> Void

    init(onEvent: @escaping @Sendable (String) -> Void) {
        self.onEvent = onEvent
    }

    func onEvent(eventJson: String) {
        onEvent(eventJson)
    }
}
