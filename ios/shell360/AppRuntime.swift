import Foundation
import Combine
import SwiftUI

@MainActor
final class AppRuntime: ObservableObject {
    let bridgeRouter = BridgeRouter()
    let rustBridge: RustBridge
    let jsb = Jsb()

    init() {
        rustBridge = RustBridge { [weak bridgeRouter] event in
            bridgeRouter?.emit(event: event)
        }
        bridgeRouter.rustBridge = rustBridge
        jsb.handlersReleaseClient = { [weak rustBridge] clientId in
            rustBridge?.releaseClient(clientId)
        }
        registerIosRoutes(jsb: jsb, rustBridge: rustBridge)
    }
}
