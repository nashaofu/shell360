import SwiftUI

struct AppContainerView: View {
    @ObservedObject var runtime: AppRuntime

    var body: some View {
        WebViewContainer(jsb: runtime.jsb)
            .ignoresSafeArea()
    }
}
