#!/usr/bin/env bash
set -euo pipefail

rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
pnpm run ios:build
