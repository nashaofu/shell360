import Foundation
import Combine
import SwiftUI

@MainActor
final class AppRuntime: ObservableObject {
    let rustBridge: RustBridge
    let jsb = Jsb()

    init() {
        rustBridge = RustBridge { [weak jsb] event in
            jsb?.emit(event)
        }
        jsb.handlersReleaseClient = { [weak rustBridge] clientId in
            rustBridge?.releaseClient(clientId)
        }
        registerIosRoutes(jsb: jsb, rustBridge: rustBridge)
    }
}
