import Foundation

final class IosBinaryChannelStore: @unchecked Sendable {
    enum DequeueResult {
        case frame(Data)
        case empty
        case closed
    }

    enum StoreError: Error {
        case channelClosed
        case frameTooLarge
        case queueFull
    }

    static let maxFrameSize = 10 * 1024 * 1024

    private struct ChannelState {
        var frames: [Data] = []
        var queuedBytes = 0
    }

    private let maxQueuedBytesPerChannel = 20 * 1024 * 1024
    private let lock = NSLock()
    private var channels: [String: ChannelState] = [:]

    func open(_ channelId: String) {
        withLock {
            channels[channelId] = ChannelState()
        }
    }

    func close(_ channelId: String) {
        _ = withLock {
            channels.removeValue(forKey: channelId)
        }
    }

    func closeAll() {
        withLock {
            channels.removeAll()
        }
    }

    func enqueue(_ data: Data, channelId: String) throws -> Bool {
        try withLock {
            guard data.count <= Self.maxFrameSize else {
                throw StoreError.frameTooLarge
            }
            guard var channel = channels[channelId] else {
                throw StoreError.channelClosed
            }
            guard channel.queuedBytes + data.count <= maxQueuedBytesPerChannel else {
                throw StoreError.queueFull
            }

            let shouldNotify = channel.frames.isEmpty
            channel.frames.append(data)
            channel.queuedBytes += data.count
            channels[channelId] = channel
            return shouldNotify
        }
    }

    func dequeue(channelId: String) -> DequeueResult {
        withLock {
            guard var channel = channels[channelId] else {
                return .closed
            }
            guard !channel.frames.isEmpty else {
                return .empty
            }

            let data = channel.frames.removeFirst()
            channel.queuedBytes -= data.count
            channels[channelId] = channel
            return .frame(data)
        }
    }

    private func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try body()
    }
}
