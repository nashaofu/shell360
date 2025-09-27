# Android Build Script - Shell360
# Purpose: Build Android application, set up environment and generate APK/AAB files

# Set error action preference to stop on error
$ErrorActionPreference = "Stop"

# Add Rust target architectures
Write-Host "[INFO] Adding Rust targets for Android..."
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

# Install NDK (only if not already installed)
Write-Host "[INFO] Checking and configuring Android NDK..."
$ndkPath = "$env:ANDROID_HOME/ndk/29.0.14033849"
if (-not (Test-Path -Path $ndkPath -PathType Container)) {
  Write-Host "[INFO] Installing NDK 29.0.14033849..."
  sdkmanager --install "ndk;29.0.14033849"
}
$env:NDK_HOME = $ndkPath
$env:PATH = "$env:NDK_HOME/toolchains/llvm/prebuilt/windows-x86_64/bin;$env:PATH"

# Configure signing key - Important step
Write-Host "[INFO] Configuring Android signing keys..."
[System.IO.File]::WriteAllBytes("$env:TEMP\release.jks", [System.Convert]::FromBase64String($env:ANDROID_KEY_JKS))
@(
  "storePassword=$env:ANDROID_STORE_PASSWORD",
  "keyPassword=$env:ANDROID_KEY_PASSWORD",
  "keyAlias=$env:ANDROID_KEY_ALIAS",
  "storeFile=$($env:TEMP -replace '\\', '/')/release.jks"
) | Set-Content -Path "src-tauri/gen/android/key.properties"

# Prepare build directory
Write-Host "[INFO] Preparing build directory..."
Remove-Item -Path build -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path build

# Build application - Core step
Write-Host "[INFO] Building Android application..."
pnpm tauri android build

# Move build files to build directory
Write-Host "[INFO] Moving build artifacts to build directory..."
# Move APK file
Get-ChildItem -Path "src-tauri/gen/android/app/build/outputs/apk/universal/release" -Filter "*.apk" |
Move-Item -Destination "build" -Force

# Move AAB file
Get-ChildItem -Path "src-tauri/gen/android/app/build/outputs/bundle/universalRelease" -Filter "*.aab" |
Move-Item -Destination "build" -Force

Write-Host "[INFO] Build process completed, artifacts located in build directory"
