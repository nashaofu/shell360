#!/usr/bin/env bash

# Android Build Script - Shell360
# Purpose: Build Android application and generate APK/AAB packages

set -e

# Add required Rust targets for Android
echo "[INFO] Adding Rust targets for Android..."
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [ ! -d "$ANDROID_HOME" ]; then
  echo "[INFO] Creating Android SDK directory at $ANDROID_HOME..."
  mkdir -p "$ANDROID_HOME"
fi

CMDLINE_TOOLS_DIR="$ANDROID_HOME/cmdline-tools/latest"

# Install Android command line tools only when sdkmanager is unavailable.
if [ -x "$CMDLINE_TOOLS_DIR/bin/sdkmanager" ]; then
  echo "[INFO] Found sdkmanager in $CMDLINE_TOOLS_DIR"
else
  echo "[INFO] sdkmanager not found, installing Android command line tools..."

  EXTRACT_DIR=/tmp/cmdline-tools-extract
  ZIP_PATH=/tmp/cmdline-tools.zip

  rm -rf "$CMDLINE_TOOLS_DIR" $EXTRACT_DIR
  mkdir -p $EXTRACT_DIR "$ANDROID_HOME/cmdline-tools"

  wget -c -O "$ZIP_PATH" https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip

  CMDLINE_TOOLS_SHA256=48833c34b761c10cb20bcd16582129395d121b27
  ACTUAL_SHA256=$(sha256sum "$ZIP_PATH" | awk '{print $1}')
  if [ "${ACTUAL_SHA256:0:${#CMDLINE_TOOLS_SHA256}}" != "$CMDLINE_TOOLS_SHA256" ]; then
    echo "[ERROR] SHA-256 checksum verification failed for cmdline-tools.zip"
    exit 1
  fi

  unzip "$ZIP_PATH" -d "$EXTRACT_DIR"
  mv "$EXTRACT_DIR/cmdline-tools" "$CMDLINE_TOOLS_DIR"
fi

export PATH="$CMDLINE_TOOLS_DIR/bin:$PATH"

yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses

# Install NDK if not already installed
echo "[INFO] Checking and configuring Android NDK..."
NDK_VERSION="29.0.14206865"
if [ ! -d "$ANDROID_HOME/ndk/$NDK_VERSION" ]; then
  echo "[INFO] Installing NDK $NDK_VERSION..."
  sdkmanager --install "ndk;$NDK_VERSION"
fi
export NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"
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
