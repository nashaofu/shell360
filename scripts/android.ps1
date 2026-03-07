# Android Build Script - Shell360
# Purpose: Build Android application and generate APK/AAB packages

$ErrorActionPreference = "Stop"

# Add required Rust targets for Android
Write-Host "[INFO] Adding Rust targets for Android..."
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

if (-not $env:ANDROID_HOME) {
  $env:ANDROID_HOME = Join-Path $HOME "AppData/Local/Android/Sdk"
  if (-not (Test-Path -Path $env:ANDROID_HOME -PathType Container)) {
    Write-Host "[INFO] Creating Android SDK directory at $env:ANDROID_HOME..."
    New-Item -Path $env:ANDROID_HOME -ItemType Directory -Force | Out-Null
  }
} else {
  Write-Host "[INFO] Using existing ANDROID_HOME: $env:ANDROID_HOME"
}

$cmdlineToolsDir = Join-Path $env:ANDROID_HOME "cmdline-tools/latest"
$sdkManager = Join-Path $cmdlineToolsDir "bin/sdkmanager.bat"

# Install Android command line tools only when sdkmanager is unavailable.
if (Test-Path -Path $sdkManager -PathType Leaf) {
  Write-Host "[INFO] Found sdkmanager in $cmdlineToolsDir"
} else {
  Write-Host "[INFO] sdkmanager not found, installing Android command line tools..."

  $extractDir = Join-Path $env:TEMP "cmdline-tools-extract"
  $zipPath = Join-Path $env:TEMP "cmdline-tools.zip"

  Remove-Item -Path $cmdlineToolsDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -Path $extractDir -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -Path $extractDir -ItemType Directory -Force | Out-Null
  New-Item -Path (Join-Path $env:ANDROID_HOME "cmdline-tools") -ItemType Directory -Force | Out-Null

  Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-14742923_latest.zip" -OutFile $zipPath
  $expectedSha256 = "16b3f45ddb3d85ea6bbe6a1c0b47146daf0db450"
  $actualSha256 = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
  if ($actualSha256 -ne $expectedSha256) {
    Write-Error "[ERROR] SHA-256 checksum verification failed for cmdline-tools.zip"
    exit 1
  }
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

  Move-Item -Path (Join-Path $extractDir "cmdline-tools") -Destination $cmdlineToolsDir -Force
}

$env:PATH = "$(Join-Path $cmdlineToolsDir 'bin');$env:PATH"

# Accept Android SDK licenses non-interactively.
1..20 | ForEach-Object { "y" } | & $sdkManager --sdk_root="$env:ANDROID_HOME" --licenses

# Install NDK if not already installed
Write-Host "[INFO] Checking and configuring Android NDK..."
$ndkVersion = "29.0.14206865"
$ndkPath = Join-Path $env:ANDROID_HOME "ndk/$ndkVersion"
if (-not (Test-Path -Path $ndkPath -PathType Container)) {
  Write-Host "[INFO] Installing NDK $ndkVersion..."
  & $sdkManager --install "ndk;$ndkVersion"
}

$env:NDK_HOME = $ndkPath
$env:PATH = "$(Join-Path $env:NDK_HOME 'toolchains/llvm/prebuilt/windows-x86_64/bin');$env:PATH"

# Configure signing keys
Write-Host "[INFO] Configuring Android signing keys..."
$releaseJks = Join-Path $env:TEMP "release.jks"
[System.IO.File]::WriteAllBytes($releaseJks, [System.Convert]::FromBase64String($env:ANDROID_KEY_JKS))

$keyPropertiesPath = "src-tauri/gen/android/key.properties"
@(
  "storePassword=$env:ANDROID_STORE_PASSWORD"
  "keyPassword=$env:ANDROID_KEY_PASSWORD"
  "keyAlias=$env:ANDROID_KEY_ALIAS"
  "storeFile=$($releaseJks -replace '\\', '/')"
) | Set-Content -Path $keyPropertiesPath -Encoding Ascii

# Prepare build directory
Write-Host "[INFO] Preparing build directory..."
Remove-Item -Path build -Recurse -Force -ErrorAction SilentlyContinue
New-Item -Path build -ItemType Directory -Force | Out-Null

# Build Android application
Write-Host "[INFO] Building Android application..."
pnpm tauri android build

# Move APK and AAB files to build directory
Write-Host "[INFO] Moving build artifacts to build directory..."
Get-ChildItem -Path "src-tauri/gen/android/app/build/outputs/apk/universal/release" -File -Filter "*.apk" |
  Move-Item -Destination "build" -Force

Get-ChildItem -Path "src-tauri/gen/android/app/build/outputs/bundle/universalRelease" -File -Filter "*.aab" |
  Move-Item -Destination "build" -Force

Write-Host "[INFO] Build process completed, artifacts located in build directory"
