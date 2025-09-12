#!/usr/bin/env bash

set -e

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

