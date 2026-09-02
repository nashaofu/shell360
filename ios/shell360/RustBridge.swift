import Foundation

final class RustBridge: @unchecked Sendable {
    private let runtime: Shell360Runtime?
    private let lock = NSLock()
    private var eventListener: EventListener?

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
            cacheDir: cache.path,
            eventSink: RustEventSink(
                onEvent: { [weak self] event in
                    self?.currentEventListener()?.onEvent(event)
                },
                onSshShellData: { [weak self] clientId, sshShellId, data in
                    self?.currentEventListener()?.onSshShellData(clientId, sshShellId, data)
                }
            )
        )
    }

    func createJsbEngine(hostServices: HostServices) -> NativeJsbEngine? {
        guard let runtime else { return nil }
        return NativeJsbEngine(runtime: runtime, hostServices: hostServices)
    }

    func setEventListener(
        owner: AnyObject,
        onEvent: @escaping @Sendable (String) -> Void,
        onSshShellData: @escaping @Sendable (String, String, Data) -> Void
    ) {
        lock.lock()
        defer { lock.unlock() }
        eventListener = EventListener(owner: owner, onEvent: onEvent, onSshShellData: onSshShellData)
    }

    func clearEventListener(owner: AnyObject) {
        lock.lock()
        defer { lock.unlock() }
        if eventListener?.owner === owner {
            eventListener = nil
        }
    }

    func healthCheck() -> String {
        runtime?.healthCheck() ?? "unavailable"
    }

    func shutdown() {
        runtime?.shutdown()
    }

    private func currentEventListener() -> EventListener? {
        lock.lock()
        defer { lock.unlock() }
        return eventListener
    }

    private final class EventListener {
        let owner: AnyObject
        let onEvent: @Sendable (String) -> Void
        let onSshShellData: @Sendable (String, String, Data) -> Void

        init(
            owner: AnyObject,
            onEvent: @escaping @Sendable (String) -> Void,
            onSshShellData: @escaping @Sendable (String, String, Data) -> Void
        ) {
            self.owner = owner
            self.onEvent = onEvent
            self.onSshShellData = onSshShellData
        }
    }
}

final class RustEventSink: FfiEventSink, @unchecked Sendable {
    private let onEvent: @Sendable (String) -> Void
    private let onSshShellDataCallback: @Sendable (String, String, Data) -> Void

    init(
        onEvent: @escaping @Sendable (String) -> Void,
        onSshShellData: @escaping @Sendable (String, String, Data) -> Void
    ) {
        self.onEvent = onEvent
        onSshShellDataCallback = onSshShellData
    }

    func onEvent(eventJson: String) {
        onEvent(eventJson)
    }

    func onSshShellData(clientId: String, sshShellId: String, data: Data) {
        onSshShellDataCallback(clientId, sshShellId, data)
    }
}
