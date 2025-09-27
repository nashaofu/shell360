#!/usr/bin/env zsh

# iOS Build Script - Shell360
# Purpose: Build iOS application and generate IPA installation package

set -e

# Add required Rust targets for iOS
echo "[INFO] Adding Rust targets for iOS..."
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

# Configure Apple API key
echo "[INFO] Configuring Apple API key..."
echo "$APPLE_API_KEY_TEXT" | openssl base64 -d -A -out "/tmp/apple_api_key.p8"
export APPLE_API_KEY_PATH="/tmp/apple_api_key.p8"

# Prepare build directory
echo "[INFO] Preparing build directory..."
rm -rf build
mkdir build

# Build iOS application
echo "[INFO] Building iOS application..."
pnpm tauri ios build --export-method app-store-connect

# Move IPA file to build directory
echo "[INFO] Moving build artifacts to build directory..."
find src-tauri/gen/apple/build/arm64 -maxdepth 1 -type f -name "*.ipa" -exec mv {} build \;

echo "[INFO] Build process completed, artifacts located in build directory"

