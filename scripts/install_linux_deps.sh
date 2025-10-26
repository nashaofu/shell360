#!/usr/bin/env bash

# Linux Dependencies Installation Script - Shell360
# Purpose: Install system dependencies required for building Linux version

set -e

echo "[INFO] Updating system package list..."
sudo apt-get update

echo "[INFO] Installing dependencies required for Linux application build..."
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
  libayatana-appindicator3-dev # Application indicator support

echo "[INFO] Linux build dependencies installation completed!"
