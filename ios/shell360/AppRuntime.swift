import Foundation
import SwiftUI

@MainActor
final class AppRuntime: ObservableObject {
    let rustBridge: RustBridge

    init() {
        rustBridge = RustBridge()
    }
}
