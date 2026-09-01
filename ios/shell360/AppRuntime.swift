import Foundation
import Combine
import SwiftUI

@MainActor
final class AppRuntime: ObservableObject {
    let rustBridge: RustBridge
    let jsb = Jsb()

    init() {
        rustBridge = RustBridge(
            onEvent: { [weak jsb] event in
                jsb?.emit(event)
            },
            onSshShellData: { [weak jsb] clientId, sshShellId, data in
                jsb?.emitSshShellData(clientId: clientId, sshShellId: sshShellId, data: data)
            }
        )
        jsb.handlersReleaseClient = { [weak rustBridge] clientId in
            rustBridge?.releaseClient(clientId)
        }
        jsb.sshShellDataHandler = { [weak rustBridge] clientId, sshShellId, data in
            guard let rustBridge else { throw RustBridgeError.unavailable }
            try rustBridge.sendSshShellData(clientId: clientId, sshShellId: sshShellId, data: data)
        }
        registerIosRoutes(jsb: jsb, rustBridge: rustBridge)
    }
}
