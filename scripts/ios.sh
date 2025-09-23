#!/usr/bin/env zsh

set -e

rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

echo "$APPLE_API_KEY_TEXT" | openssl base64 -d -A -out "/tmp/apple_api_key.p8"
export APPLE_API_KEY_PATH="/tmp/apple_api_key.p8"

pnpm tauri ios build --export-method app-store-connect
rm -rf build
mkdir build
find src-tauri/gen/apple/build/arm64 -maxdepth 1 -type f -name "*.ipa" -exec mv {} build \;
