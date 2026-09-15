#!/usr/bin/env bash
set -euo pipefail

android sdk install platform-tools platforms/android-37.1 build-tools/37.0.0 ndk/30.0.15729638
rustup target add aarch64-linux-android x86_64-linux-android
pnpm run android:build
