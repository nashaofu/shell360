# Contribution Guide

Thank you for considering contributing to the Shell360 project! This guide will help you set up your development environment, submit code, and follow project conventions.

## Project Overview

Shell360 is a cross-platform SSH and SFTP client built with the Tauri framework, supporting Windows, macOS, and Android. The project uses a monorepo structure with the following main components:

- **desktop**: Desktop application code
- **mobile**: Mobile application code
- **shared**: Shared codebase
- **src-tauri**: Tauri backend code
- **tauri-plugin-***: Custom Tauri plugins

## Development Environment Setup

Prepare the required environment according to the [Tauri official documentation](https://tauri.app/start/prerequisites/).

### Windows Development Specific Requirements

When developing Windows applications on Windows, you need to install the latest versions of MSVC x86, x64, and arm64 build tools to support cross-compilation.

### Android Development Specific Requirements

Android development requires installing Android Studio and configuring environment variables:

```shell
# Linux environment variables configuration example
export ANDROID_HOME="~/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)"
export JAVA_HOME="/opt/android-studio/jbr"
export PATH="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"
export PATH="$ANDROID_HOME/tools/bin:$PATH"
export PATH="$ANDROID_HOME/emulator:$PATH"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export PATH="$JAVA_HOME/bin:$PATH"
```

For Windows or macOS, adjust the paths and environment variable settings accordingly.

## Project Setup

### Clone the Repository

```bash
git clone https://github.com/nashaofu/shell360.git
cd shell360
```

### Install Dependencies

```bash
pnpm install
```

## Development Testing

After setting up the project, run the following commands to start the project locally:

```bash
# Desktop
pnpm tauri dev

# Android
pnpm tauri android dev

# iOS
pnpm tauri ios dev
```

## Build Guide

For local build testing, use the following commands:

```bash
# Desktop
pnpm tauri build

# Android
pnpm tauri android build

# iOS
pnpm tauri ios build
```

To build distributable application versions, you need to complete the relevant configurations according to [MacOS Signing Configuration](https://tauri.app/distribute/sign/macos/), [iOS Signing Configuration](https://tauri.app/distribute/sign/ios/), [Android Signing Configuration](https://tauri.app/distribute/sign/android/), and [Application Update Configuration](https://tauri.app/plugin/updater/). Then add the following `.env` file in the project root directory and fill in the relevant configurations:

```shell
# Desktop application update private key
TAURI_SIGNING_PRIVATE_KEY=
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
# Apple API Issuer https://tauri.app/distribute/sign/macos/#notarization
APPLE_API_ISSUER=
APPLE_API_KEY=
APPLE_API_KEY_PATH=
# MacOS
# MacOS signing uses Developer ID Application certificate
APPLE_SIGNING_IDENTITY= # Certificate name identifier, e.g.: "Developer ID Application: Your Name (Your Team ID)"
APPLE_CERTIFICATE= # The p12 file exported from the certificate, encoded as base64 string
APPLE_CERTIFICATE_PASSWORD= # Encryption password when exporting p12 certificate
# iOS
# iOS signing uses Apple Distribution certificate
IOS_CERTIFICATE= # The p12 file exported from the certificate, encoded as base64 string
IOS_CERTIFICATE_PASSWORD= # Encryption password when exporting p12 certificate
IOS_MOBILE_PROVISION= # iOS mobile provisioning profile file, encoded as base64 string
# Android
# Refer to https://developer.android.com/studio/publish/app-signing for generating app signing parameters
# You can directly use the following command to generate a signing file:
# keytool -genkey -v -keystore ./upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload -keypass keypass -storepass storepass
ANDROID_KEY_ALIAS= # The alias parameter used when running the keytool command
ANDROID_STORE_PASSWORD= # The storepass parameter entered when running the keytool command
ANDROID_KEY_PASSWORD= # The keypass parameter entered when running the keytool command
ANDROID_KEY_JKS= # The generated .jks file, encoded in base64
```

Then, execute the following build commands as needed to build signed applications:

- Windows Build

```powershell
pnpm dotenvx powershell .\scripts\windows.ps1
```

- MacOS, Linux, Android, iOS Build

```bash
pnpm dotenvx ./scripts/[platform].sh
```

### Special Notes

Certificates and Provisioning Profile files for MacOS and iOS signing can be obtained by following these steps:

1. Ensure you have an Apple Developer account and are logged into Xcode.
2. Log in with your Apple ID in Xcode accounts, add the required certificate types in Xcode, then export the certificate as a [p12 file](https://en.wikipedia.org/wiki/PKCS_12) in Xcode or Keychain. For detailed steps, refer to: https://help.apple.com/xcode/mac/current/#/dev154b28f09. The p12 file contains the key (private key) and cer (certificate). The Apple developer website only allows downloading certificates; the private key is stored in the system keychain. Please keep the p12 file secure, do not share it with others, and make backups.

3. Certificate type description: https://developer.apple.com/help/account/reference/certificate-types. This document uses Developer ID Application certificates for MacOS distribution signing and Apple Distribution certificates for iOS distribution signing.

   - Developer ID Application: Used to sign Mac apps distributed outside the Mac App Store.
   - Apple Distribution: Distribute your iOS, macOS, Apple tvOS, or watchOS apps to designated devices for testing or submit them to the App Store.
   - iOS Distribution (App Store Connect and Ad Hoc): Distribute your iOS, Apple tvOS, or watchOS apps to designated devices for testing or submit them to the App Store.
   - Mac App Distribution: Sign Mac apps before submitting them to the Mac App Store.

4. iOS Provisioning Profile generation: https://developer.apple.com/help/account/manage-provisioning-profiles/create-a-development-provisioning-profile

Once you have the certificate file, base64 encode the p12 file and write the encoded content to the `APPLE_CERTIFICATE` or `IOS_CERTIFICATE` variables in the `.env` file.

```bash
openssl base64 -A -in <p12 file path> -out <p12 file base64 encoded file path>
```

## Plugin Development

The project includes three custom Tauri plugins:

- **tauri-plugin-mobile**: Mobile-specific functionality
- **tauri-plugin-ssh**: SSH connection functionality
- **tauri-plugin-data**: Data management functionality

To develop plugins, modify the code in the corresponding directories and update dependencies as needed.

## Submit a Pull Request

1. Create a new branch
2. Implement your changes
3. Ensure the code passes all tests and checks
4. Commit your code following the commit guidelines
5. Create a Pull Request describing your changes

## Report Issues

If you find an issue, create an Issue on GitHub and describe the problem as detailed as possible:

- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Relevant error messages and screenshots
- Your environment information (operating system, browser, etc.)
