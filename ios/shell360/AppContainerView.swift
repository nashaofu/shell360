import SwiftUI

struct AppContainerView: View {
    @ObservedObject var runtime: AppRuntime

    var body: some View {
        WebViewContainer(router: runtime.bridgeRouter)
            .ignoresSafeArea()
    }
}
