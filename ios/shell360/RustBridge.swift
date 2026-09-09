import Foundation

final class RustBridge: @unchecked Sendable {
    let appDataDirectory: URL
    private let runtime: Shell360Runtime?
    let initializationError: Error?

    init() {
        let fileManager = FileManager.default
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        let appData = appSupport.appendingPathComponent("shell360", isDirectory: true)
        appDataDirectory = appData
        let cache = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
            .appendingPathComponent("shell360", isDirectory: true)
        try? fileManager.createDirectory(at: appData, withIntermediateDirectories: true)
        try? fileManager.createDirectory(at: cache, withIntermediateDirectories: true)

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""

        do {
            runtime = try Shell360Runtime(
                appDataDir: appData.path,
                cacheDir: cache.path,
                appVersion: version
            )
            initializationError = nil
        } catch {
            runtime = nil
            initializationError = error
        }
    }

    func createJsb(transport: JsbTransport, hostServices: HostServices) -> NativeJsb? {
        guard let runtime else { return nil }
        return NativeJsb(runtime: runtime, transport: transport, hostServices: hostServices)
    }

    func shutdown() {
        runtime?.shutdown()
    }
}
