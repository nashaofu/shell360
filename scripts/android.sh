#!/usr/bin/env bash
set -euo pipefail

sdkmanager "platform-tools" "platforms;android-37" "build-tools;37.0.1" "ndk;30.0.15729638"
rustup target add aarch64-linux-android x86_64-linux-android
pnpm run android:build
