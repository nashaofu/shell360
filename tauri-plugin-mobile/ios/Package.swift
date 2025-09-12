// swift-tools-version:5.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
  name: "tauri-plugin-mobile",
  platforms: [
    .iOS(.v13),
    .macOS(.v10_15),
  ],
  products: [
    // Products define the executables and libraries a package produces, and make them visible to other packages.
    .library(
      name: "tauri-plugin-mobile",
      type: .static,
      targets: ["tauri-plugin-mobile"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api"),
    .package(
      url: "https://github.com/RevenueCat/purchases-ios-spm.git",
      .upToNextMinor(from: "5.32.0")
    ),
  ],
  targets: [
    // Targets are the basic building blocks of a package. A target can define a module or a test suite.
    // Targets can depend on other targets in this package, and on products in packages this package depends on.
    .target(
      name: "tauri-plugin-mobile",
      dependencies: [
        .byName(name: "Tauri"),
        .product(name: "RevenueCat", package: "purchases-ios-spm"),
        .product(name: "RevenueCatUI", package: "purchases-ios-spm"),
      ],
      path: "Sources")
  ]
)
