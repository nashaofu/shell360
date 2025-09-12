#!/usr/bin/env bash

set -e

rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  gcc-aarch64-linux-gnu \
  libwebkit2gtk-4.1-dev \
  curl \
  wget \
  file \
  libssl-dev \
  librsvg2-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev
pnpm tauri build --target x86_64-unknown-linux-gnu
# pnpm tauri build --target aarch64-unknown-linux-gnu
rm -rf build
mkdir build
find target/x86_64-unknown-linux-gnu/release/bundle/deb -maxdepth 1 -type f -name "*.deb" -exec mv -t build {} \;
find target/x86_64-unknown-linux-gnu/release/bundle/rpm -maxdepth 1 -type f -name "*.rpm" -exec mv -t build {} \;
find target/x86_64-unknown-linux-gnu/release/bundle/appimage -maxdepth 1 -type f -name "*.AppImage*" -exec mv -t build {} \;
