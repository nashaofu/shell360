#!/usr/bin/env zsh

set -e

rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
pnpm tauri ios build --export-method app-store-connect
rm -rf build
mkdir build
find src-tauri/gen/apple/build/arm64 -maxdepth 1 -type f -name "*.ipa" -exec mv {} build \;
