# Windows Build Script - Shell360
# Purpose: Build application for multiple Windows target architectures

# Set error action preference to stop on error
$ErrorActionPreference = "Stop"

# Function: Build application for specific target architecture
function Invoke-TargetBuild {
  param(
    [string]$TargetArchitecture,
    [string]$ConfigFile = ""
  )

  Write-Host "[INFO] Building for target architecture: $TargetArchitecture"

  # Build command parameters (using parameter array)
  $buildArgs = @("tauri", "build", "--target", $TargetArchitecture, "--bundles", "nsis")
  if ($ConfigFile) {
    $buildArgs += @("--config", $ConfigFile)
  }

  # Use pnpm to call tauri
  pnpm @buildArgs

  # Check build result
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed, target architecture: $TargetArchitecture"
  }

  Write-Host "[INFO] Build successful, target architecture: $TargetArchitecture"
}

# Function: Move build files to build directory
function Move-BuildFiles {
  param(
    [string]$TargetArchitecture,
    [string]$Suffix = ""
  )

  $sourcePath = "target/$TargetArchitecture/release/bundle/nsis"
  Write-Host "[INFO] Moving files from $sourcePath to build directory"

  if ($Suffix) {
    # For webview builds, rename files before moving
    Get-ChildItem -Path $sourcePath -File -Filter *.exe | ForEach-Object {
      $newName = $_.Name -replace '\.exe$', "$Suffix.exe"
      Write-Host "[INFO] Renaming $_ to $newName"
      Rename-Item -Path $_.FullName -NewName $newName
      Move-Item -Path (Join-Path -Path $_.DirectoryName -ChildPath $newName) -Destination 'build'
    }
  }
  else {
    # For regular builds, move files directly
    Get-ChildItem -Path $sourcePath -File -Filter *.exe* | Move-Item -Destination 'build'
  }
}

# Define target architectures list
$targetArchitectures = @(
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "i686-pc-windows-msvc"
)

# Add required Rust targets
Write-Host "[INFO] Adding Rust targets for Windows..."
rustup target add @targetArchitectures

# Prepare build directory
Write-Host "[INFO] Preparing build directory..."
Remove-Item -Path build -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path build

# Build with default configuration for each architecture
Write-Host "=== Building with default configuration ==="
foreach ($target in $targetArchitectures) {
  Invoke-TargetBuild -TargetArchitecture $target
}

# Move regular build files to build directory
Write-Host "[INFO] Moving regular build files..."
foreach ($target in $targetArchitectures) {
  Move-BuildFiles -TargetArchitecture $target
}

# Build with webview configuration for each architecture
Write-Host "=== Building with webview configuration ==="
$webviewConfig = "./src-tauri/tauri.webview.conf.json"
foreach ($target in $targetArchitectures) {
  Invoke-TargetBuild -TargetArchitecture $target -ConfigFile $webviewConfig
}

# Move webview build files to build directory with suffix
Write-Host "[INFO] Moving webview build files with '-webview' suffix..."
foreach ($target in $targetArchitectures) {
  Move-BuildFiles -TargetArchitecture $target -Suffix "-webview"
}

Write-Host "[INFO] Build process completed successfully, artifacts located in build directory"
