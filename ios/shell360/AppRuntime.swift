import Combine
import Foundation
import SwiftUI

@MainActor
final class AppRuntime: ObservableObject {
    @Published private(set) var rustBridge: RustBridge

    init() {
        rustBridge = RustBridge()
    }
}
