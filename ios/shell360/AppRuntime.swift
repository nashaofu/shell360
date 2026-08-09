import Foundation
import Combine
import SwiftUI

@MainActor
final class AppRuntime: ObservableObject {
    let bridgeRouter = BridgeRouter()
    let rustBridge: RustBridge

    init() {
        rustBridge = RustBridge { [weak bridgeRouter] event in
            bridgeRouter?.emit(event: event)
        }
        bridgeRouter.rustBridge = rustBridge
    }
}
