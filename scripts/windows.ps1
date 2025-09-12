$ErrorActionPreference = "Stop"

rustup target add x86_64-pc-windows-msvc aarch64-pc-windows-msvc i686-pc-windows-msvc

pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

pnpm tauri build --target aarch64-pc-windows-msvc --bundles nsis
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

pnpm tauri build --target i686-pc-windows-msvc --bundles nsis
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Remove-Item -Path build -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path build
Get-ChildItem -Path 'target/x86_64-pc-windows-msvc/release/bundle/nsis' -File -Filter *.exe* | Move-Item -Destination 'build'
Get-ChildItem -Path 'target/aarch64-pc-windows-msvc/release/bundle/nsis' -File -Filter *.exe* | Move-Item -Destination 'build'
Get-ChildItem -Path 'target/i686-pc-windows-msvc/release/bundle/nsis' -File -Filter *.exe* | Move-Item -Destination 'build'

pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis --config ./src-tauri/tauri.webview.conf.json
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

pnpm tauri build --target aarch64-pc-windows-msvc --bundles nsis --config ./src-tauri/tauri.webview.conf.json
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

pnpm tauri build --target i686-pc-windows-msvc --bundles nsis --config ./src-tauri/tauri.webview.conf.json
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

# 拷贝 exe 文件到 build 文件夹 ，并从在文件名称中添加 webview 后缀
Get-ChildItem -Path 'target/x86_64-pc-windows-msvc/release/bundle/nsis' -File -Filter *.exe | ForEach-Object {
    $newName = $_.Name -replace '\.exe$', '-webview.exe'
    Rename-Item -Path $_.FullName -NewName $newName
    Move-Item -Path (Join-Path -Path $_.DirectoryName -ChildPath $newName) -Destination 'build'
}
Get-ChildItem -Path 'target/aarch64-pc-windows-msvc/release/bundle/nsis' -File -Filter *.exe | ForEach-Object {
    $newName = $_.Name -replace '\.exe$', '-webview.exe'
    Rename-Item -Path $_.FullName -NewName $newName
    Move-Item -Path (Join-Path -Path $_.DirectoryName -ChildPath $newName) -Destination 'build'
}
Get-ChildItem -Path 'target/i686-pc-windows-msvc/release/bundle/nsis' -File -Filter *.exe | ForEach-Object {
    $newName = $_.Name -replace '\.exe$', '-webview.exe'
    Rename-Item -Path $_.FullName -NewName $newName
    Move-Item -Path (Join-Path -Path $_.DirectoryName -ChildPath $newName) -Destination 'build'
}
