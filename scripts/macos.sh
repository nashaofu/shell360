#!/usr/bin/env zsh

set -e

rename_file() {
  file=$(basename $1)
  dir=$(dirname $1)
  arch=$2

  src=$dir/$file
  dist="$dir/${file/.app/-$arch.app}"

  mv $src $dist

  echo "Renamed $src to $dist"
}

rustup target add x86_64-apple-darwin aarch64-apple-darwin
pnpm tauri build --target x86_64-apple-darwin
pnpm tauri build --target aarch64-apple-darwin
rm -rf build
mkdir build

for file in target/x86_64-apple-darwin/release/bundle/macos/*.app*; do
  rename_file $file x64
done

for file in target/aarch64-apple-darwin/release/bundle/macos/*.app*; do
  rename_file $file aarch64
done

find target/x86_64-apple-darwin/release/bundle/dmg -maxdepth 1 -type f -name "*.dmg" -exec mv {} build \;
find target/x86_64-apple-darwin/release/bundle/macos -maxdepth 1 -type f -name "*.app*" -exec mv {} build \;
find target/aarch64-apple-darwin/release/bundle/dmg -maxdepth 1 -type f -name "*.dmg" -exec mv {} build \;
find target/aarch64-apple-darwin/release/bundle/macos -maxdepth 1 -type f -name "*.app*" -exec mv {} build \;
