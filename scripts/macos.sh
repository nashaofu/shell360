#!/usr/bin/env zsh

# macOS Build Script - Shell360
# Purpose: Build macOS application for x86_64 and ARM64 architectures, generate DMG and App bundles

set -e

# Function to rename files with architecture suffix
function rename_file() {
  file=$(basename $1)
  dir=$(dirname $1)
  arch=$2

  src=$dir/$file
  dist="$dir/${file/.app/-$arch.app}"

  mv $src $dist

  echo "[INFO] Renamed $src to $dist"
}

# Add required Rust targets for macOS
echo "[INFO] Adding Rust targets for macOS..."
rustup target add x86_64-apple-darwin aarch64-apple-darwin

# Configure Apple API key
echo "[INFO] Configuring Apple API key..."
echo "$APPLE_API_KEY_TEXT" | openssl base64 -d -A -out "/tmp/apple_api_key.p8"
export APPLE_API_KEY_PATH="/tmp/apple_api_key.p8"

# Prepare build directory
echo "[INFO] Preparing build directory..."
rm -rf build
mkdir build

echo "[INFO] Building macOS application..."
# Build for x86_64 architecture
pnpm tauri build --target x86_64-apple-darwin
# Build for ARM64 architecture
pnpm tauri build --target aarch64-apple-darwin

# Rename x86_64 App bundles with architecture suffix
echo "[INFO] Renaming x86_64 App bundles..."
for file in target/x86_64-apple-darwin/release/bundle/macos/*.app*; do
  rename_file $file x64
done

# Rename ARM64 App bundles with architecture suffix
echo "[INFO] Renaming ARM64 App bundles..."
for file in target/aarch64-apple-darwin/release/bundle/macos/*.app*; do
  rename_file $file aarch64
done

# Move DMG and App files to build directory
echo "[INFO] Moving build artifacts to build directory..."
find target/x86_64-apple-darwin/release/bundle/dmg -maxdepth 1 -type f -name "*.dmg" -exec mv {} build \;
find target/x86_64-apple-darwin/release/bundle/macos -maxdepth 1 -type f -name "*.app*" -exec mv {} build \;
find target/aarch64-apple-darwin/release/bundle/dmg -maxdepth 1 -type f -name "*.dmg" -exec mv {} build \;
find target/aarch64-apple-darwin/release/bundle/macos -maxdepth 1 -type f -name "*.app*" -exec mv {} build \;

echo "[INFO] Build process completed, artifacts located in build directory"
