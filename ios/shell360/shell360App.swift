//
//  shell360App.swift
//  shell360
//
//  Created by nsf on 2026/8/8.
//

import SwiftUI

@main
struct shell360App: App {
    @StateObject private var runtime = AppRuntime()

    var body: some Scene {
        WindowGroup {
            AppContainerView(runtime: runtime)
        }
    }
}
