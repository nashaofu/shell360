import SwiftUI

struct AppContainerView: View {
    @ObservedObject var runtime: AppRuntime

    var body: some View {
        WebViewContainer(rustBridge: runtime.rustBridge)
            .ignoresSafeArea()
    }
}
