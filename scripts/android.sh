#!/usr/bin/env bash

set -e

rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
# 安装 NDK
sdkmanager --install "ndk;26.2.11394342"
export NDK_HOME="$ANDROID_HOME/ndk/26.2.11394342"
export PATH="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"

echo "$ANDROID_KEY_JKS" | openssl base64 -d -A -out "/tmp/release.jks"
echo storePassword="$ANDROID_STORE_PASSWORD" > src-tauri/gen/android/key.properties
echo keyPassword="$ANDROID_KEY_PASSWORD" >> src-tauri/gen/android/key.properties
echo keyAlias="$ANDROID_KEY_ALIAS" >> src-tauri/gen/android/key.properties
echo storeFile="/tmp/release.jks" >> src-tauri/gen/android/key.properties

# 编译
pnpm tauri android build
rm -rf build
mkdir build
find src-tauri/gen/android/app/build/outputs/apk/universal/release -maxdepth 1 -type f -name "*.apk" -exec mv -t build {} \;
find src-tauri/gen/android/app/build/outputs/bundle/universalRelease -maxdepth 1 -type f -name "*.aab" -exec mv -t build {} \;
