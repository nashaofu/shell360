#!/usr/bin/env bash

# Android Build Script - Shell360
# Purpose: Build Android application and generate APK/AAB packages

set -e

# Add required Rust targets for Android
echo "[INFO] Adding Rust targets for Android..."
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

# Install NDK if not already installed
echo "[INFO] Checking and configuring Android NDK..."
if [ ! -d "$ANDROID_HOME/ndk/29.0.14033849" ]; then
  echo "[INFO] Installing NDK 29.0.14033849..."
  sdkmanager --install "ndk;29.0.14033849"
fi
export NDK_HOME="$ANDROID_HOME/ndk/29.0.14033849"
export PATH="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"

# Configure signing keys
echo "[INFO] Configuring Android signing keys..."
echo "$ANDROID_KEY_JKS" | openssl base64 -d -A -out "/tmp/release.jks"
echo storePassword="$ANDROID_STORE_PASSWORD" > src-tauri/gen/android/key.properties
echo keyPassword="$ANDROID_KEY_PASSWORD" >> src-tauri/gen/android/key.properties
echo keyAlias="$ANDROID_KEY_ALIAS" >> src-tauri/gen/android/key.properties
echo storeFile="/tmp/release.jks" >> src-tauri/gen/android/key.properties

# Prepare build directory
echo "[INFO] Preparing build directory..."
rm -rf build
mkdir build

# Build Android application
echo "[INFO] Building Android application..."
pnpm tauri android build

# Move APK and AAB files to build directory
echo "[INFO] Moving build artifacts to build directory..."
# Move APK file
find src-tauri/gen/android/app/build/outputs/apk/universal/release -maxdepth 1 -type f -name "*.apk" -exec mv -t build {} \;
# Move AAB file
find src-tauri/gen/android/app/build/outputs/bundle/universalRelease -maxdepth 1 -type f -name "*.aab" -exec mv -t build {} \;

echo "[INFO] Build process completed, artifacts located in build directory"
