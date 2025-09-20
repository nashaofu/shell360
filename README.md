# Shell360

<p align="center">
  <img src="./resources/icon.png" alt="Shell360 Logo" width="128">
</p>

<p align="center">
  <span>English</span> | <a href="./README-zh_cn.md">简体中文</a>
</p>

<p align="center">
  Shell360 is a cross-platform SSH & SFTP client supporting Windows, macOS, Linux, Android, and iOS.
Whether it's remote development, server management, or secure file transfer, Shell360 provides you with a consistent, smooth, and secure user experience.
</p>

## Download

Download the latest version of Shell360 for your platform:

<a href="https://apps.apple.com/app/shell360/id6502880351">
  <img src="./resources/app-store.svg" alt="Download on the App Store">
</a>

<a href="https://github.com/nashaofu/shell360/releases">
  <img src="https://img.shields.io/badge/Download%20for%20Windows-blue?style=for-the-badge" alt="Download for Windows">
</a>
<a href="https://github.com/nashaofu/shell360/releases">
  <img src="https://img.shields.io/badge/Download%20for%20macOS-blue?style=for-the-badge" alt="Download for macOS">
</a>
<a href="https://github.com/nashaofu/shell360/releases">
  <img src="https://img.shields.io/badge/Download%20for%20Linux-blue?style=for-the-badge" alt="Download for Linux">
</a>
<a href="https://github.com/nashaofu/shell360/releases">
  <img src="https://img.shields.io/badge/Download%20for%20Android-blue?style=for-the-badge" alt="Download for Android">
</a>

Join our [TestFlight](https://testflight.apple.com/join/teqJZCRm) testing program for early access to new features.

## Features

### 🔐 Secure Connection

- Advanced SSH client with support for multiple authentication methods
- ED25519, RSA, and ECDSA SSH keys
- Application data encryption for enhanced security

### 📁 File Management

- Powerful SFTP client for file transfer

### 🔄 Port Forwarding

- Local port forwarding
- Remote port forwarding
- Dynamic port forwarding (SOCKS proxy)

### 🎨 Customizable Themes

- Light and dark theme support
- 6 built-in terminal themes
- Support for custom terminal fonts

### 💻 Cross-Platform Compatibility

- Consistent experience across Windows, macOS, Linux, Android, and iOS
- Support for importing/exporting app configurations for easy synchronization between devices

## Technology Stack

Shell360 is built with modern technologies:

- **Frontend**: TypeScript, React
- **Backend**: Rust
- **Framework**: Tauri (for cross-platform support)
- **SSH Implementation**: Custom Rust SSH plugin
- **Data Storage**: Encrypted local storage

## Screenshots

### Desktop

#### Host Management

| Main Screen                                                     | Add Host                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| ![Hosts Main Screen](./resources/screenshots/desktop/hosts.png) | ![Add Host](./resources/screenshots/desktop/add-host.png) |

#### Port Forwarding

| Port Forwarding List                                                          | Add Port Forwarding                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ![Port Forwarding List](./resources/screenshots/desktop/port-forwardings.png) | ![Add Port Forwarding](./resources/screenshots/desktop/add-port-forwarding.png) |

#### Key Management

| Keys List                                              | Add Key                                                 | Generate Key                                                      |
| ------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------- |
| ![Keys List](./resources/screenshots/desktop/keys.png) | ![Add Key](./resources/screenshots/desktop/add-key.png) | ![Generate Key](./resources/screenshots/desktop/generate-key.png) |

#### Known Hosts

| Known Hosts List                                                    | Delete Known Host                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ![Known Hosts List](./resources/screenshots/desktop/knownhosts.png) | ![Delete Known Host](./resources/screenshots/desktop/delete-knownhost.png) |

#### Terminal and SFTP

| SSH Terminal                                                  | SFTP Browser                                              |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| ![SSH Terminal](./resources/screenshots/desktop/terminal.png) | ![SFTP Browser](./resources/screenshots/desktop/sftp.png) |

### Mobile

#### Hosts and Keys

| Hosts List                                                     | Add Host                                                       | Keys List                                                    | Add Key                                                      | Generate Key                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| ![Mobile Hosts List](./resources/screenshots/mobile/hosts.png) | ![Mobile Add Host](./resources/screenshots/mobile/addHost.png) | ![Mobile Keys List](./resources/screenshots/mobile/keys.png) | ![Mobile Add Key](./resources/screenshots/mobile/addKey.png) | ![Mobile Generate Key](./resources/screenshots/mobile/generateKey.png) |

#### Terminal and SFTP

| SSH Terminal                                                        | SFTP Browser                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| ![Mobile SSH Terminal](./resources/screenshots/mobile/terminal.png) | ![Mobile SFTP Browser](./resources/screenshots/mobile/sftp.png) |

### Terminal Themes

| Nord Dark                                                           | Nord Light                                                            | Solarized Dark                                                                | Solarized Light                                                                 | Tango Dark                                                            | Tango Light                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ![Nord Dark](./resources/screenshots/terminal-themes/nord-dark.png) | ![Nord Light](./resources/screenshots/terminal-themes/nord-light.png) | ![Solarized Dark](./resources/screenshots/terminal-themes/solarized-dark.png) | ![Solarized Light](./resources/screenshots/terminal-themes/solarized-light.png) | ![Tango Dark](./resources/screenshots/terminal-themes/tango-dark.png) | ![Tango Light](./resources/screenshots/terminal-themes/tango-light.png) |

## Privacy Policy

Your privacy is important to us. Please review our [Privacy Policy](./docs/Privacy-Policy.md) to understand how we handle your data.

## Contributing

We welcome contributions from the community! Please read our [Contribution Guidelines](./docs/CONTRIBUTING.md) to get started.

## License

This project is licensed under the terms of the GNU General Public License v3.0 (GPLv3).
See the [LICENSE](./LICENSE) file for details.

SPDX-License-Identifier: GPL-3.0-or-later
