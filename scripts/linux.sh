#!/usr/bin/env bash

set -e

rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu

./install_linux_deps.sh

pnpm tauri build --target x86_64-unknown-linux-gnu
# pnpm tauri build --target aarch64-unknown-linux-gnu
rm -rf build
mkdir build
find target/x86_64-unknown-linux-gnu/release/bundle/deb -maxdepth 1 -type f -name "*.deb" -exec mv -t build {} \;
find target/x86_64-unknown-linux-gnu/release/bundle/rpm -maxdepth 1 -type f -name "*.rpm" -exec mv -t build {} \;
find target/x86_64-unknown-linux-gnu/release/bundle/appimage -maxdepth 1 -type f -name "*.AppImage*" -exec mv -t build {} \;
