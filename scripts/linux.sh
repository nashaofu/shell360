#!/usr/bin/env bash

# Linux Build Script - Shell360
# Purpose: Build Linux application with multiple packaging formats (deb/rpm/AppImage)

set -e

# Get script directory
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Add required Rust targets for Linux
echo "[INFO] Adding Rust targets for Linux..."
rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu

# Install Linux dependencies
source "${SCRIPTS_DIR}/install_linux_deps.sh"

# Prepare build directory
echo "[INFO] Preparing build directory..."
rm -rf build
mkdir build

# Build for x86_64 architecture
echo "[INFO] Building Linux application..."
pnpm tauri build --target x86_64-unknown-linux-gnu

# Move build artifacts to build directory
echo "[INFO] Moving build artifacts to build directory..."
# Move DEB packages
find target/x86_64-unknown-linux-gnu/release/bundle/deb -maxdepth 1 -type f -name "*.deb" -exec mv -t build {} \;
# Move RPM packages
find target/x86_64-unknown-linux-gnu/release/bundle/rpm -maxdepth 1 -type f -name "*.rpm" -exec mv -t build {} \;
# Move AppImage files
find target/x86_64-unknown-linux-gnu/release/bundle/appimage -maxdepth 1 -type f -name "*.AppImage*" -exec mv -t build {} \;

echo "[INFO] Build process completed, artifacts located in build directory"
