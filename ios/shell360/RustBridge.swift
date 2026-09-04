import Foundation

final class RustBridge: @unchecked Sendable {
    private let runtime: Shell360Runtime?

    init() {
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
            cacheDir: cache.path
        )
    }

    func createJsb(transport: JsbTransport, hostServices: HostServices) -> NativeJsb? {
        guard let runtime else { return nil }
        return NativeJsb(runtime: runtime, transport: transport, hostServices: hostServices)
    }

    func shutdown() {
        runtime?.shutdown()
    }
}
