#!/usr/bin/env bash

# Linux Dependencies Installation Script - Shell360
# Purpose: Install system dependencies required for building Linux version

set -e

echo "[INFO] Updating system package list..."
sudo apt-get update

echo "[INFO] Installing dependencies required for Linux application build..."
sudo apt-get install -y \
  build-essential \ # Basic compilation tools
  gcc-aarch64-linux-gnu \ # ARM64 cross-compilation toolchain
  libwebkit2gtk-4.1-dev \ # WebKitGTK for webview functionality
  curl \ # Data transfer utility
  wget \ # Network download utility
  file \ # File type identification
  libssl-dev \ # SSL/TLS library development files
  librsvg2-dev \ # SVG rendering library
  libgtk-3-dev \ # GTK3 development files
  libayatana-appindicator3-dev # Application indicator support

echo "[INFO] Linux build dependencies installation completed!"

