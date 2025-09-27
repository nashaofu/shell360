# 贡献指南

非常感谢您考虑为 Shell360 项目做出贡献！本指南将帮助您了解如何设置开发环境、提交代码以及遵循项目规范。

## 项目概述

Shell360 是一个跨平台的 SSH 和 SFTP 客户端，使用 Tauri 框架构建，支持在 Windows、macOS 和 Android 上运行。项目采用 monorepo 结构，包含以下主要部分：

- **desktop**: 桌面端应用代码
- **mobile**: 移动端应用代码
- **shared**: 共享代码库
- **src-tauri**: Tauri 后端代码
- **tauri-plugin-\***: 自定义 Tauri 插件

## 开发环境准备

根据[tauri 官方文档](https://tauri.app/start/prerequisites/)要求，准备所需环境。

### Windows 开发特定要求

当在 Windows 上开发 Windows 应用时，需安装 MSVC 最新版本的 x86、x64、arm64 的编译工具，以便支持交叉编译。

### Android 开发特定要求

安卓开发需要安装 Android Studio，并配置环境变量：

```shell
# Linux 环境变量配置示例
export ANDROID_HOME="~/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)"
export JAVA_HOME="/opt/android-studio/jbr"
export PATH="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"
export PATH="$ANDROID_HOME/tools/bin:$PATH"
export PATH="$ANDROID_HOME/emulator:$PATH"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export PATH="$JAVA_HOME/bin:$PATH"
```

对于 Windows 或 macOS，请相应地调整路径和环境变量设置。

## 项目设置

### 克隆仓库

```bash
git clone https://github.com/nashaofu/shell360.git
cd shell360
```

### 安装依赖

```bash
pnpm install
```

## 开发测试

完成项目设置后，运行下面的命令，即可在本地启动项目：

```bash
# 桌面端
pnpm tauri dev

# Android
pnpm tauri android dev

# iOS
pnpm tauri ios dev
```

## 构建指南

本地构建测试可以使用如下命令：

```bash
# 桌面端
pnpm tauri build

# Android
pnpm tauri android build

# iOS
pnpm tauri ios build
```

如需要构建出可发行版本的应用，需要根据[MacOS 签名配置](https://tauri.app/distribute/sign/macos/)、[iOS 签名配置](https://tauri.app/distribute/sign/ios/)、[Android 签名配置](https://tauri.app/distribute/sign/android/)以及[应用更新配置](https://tauri.app/plugin/updater/)完成相关配置，然后在项目根目录下添加如下`.env`文件，并把相关配置填写到文件中：

```shell
# 桌面应用更新私钥
TAURI_SIGNING_PRIVATE_KEY=
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
# Apple API Issuer https://tauri.app/distribute/sign/macos/#notarization
APPLE_API_ISSUER=
APPLE_API_KEY=
APPLE_API_KEY_PATH=
# MacOS
# MacOS 签名使用 Developer ID Application 证书
APPLE_SIGNING_IDENTITY= # 证书名称标识，例如："Developer ID Application: Your Name (Your Team ID)"
APPLE_CERTIFICATE= # 证书导出的 p12 文件，并把 p12 文件使用 base64 编码为字符串
APPLE_CERTIFICATE_PASSWORD= # 导出 p12 证书时的加密密码
# iOS
# iOS 签名使用 Apple Distribution 证书
IOS_CERTIFICATE= # 证书导出的 p12 文件，并把 p12 文件使用 base64 编码为字符串
IOS_CERTIFICATE_PASSWORD= # 导出 p12 证书时的加密密码
IOS_MOBILE_PROVISION= # iOS 移动配置文件导出的 mobileprovision 文件，并把 mobileprovision 文件 使用 base64 编码为字符串
# Android
# 参考 https://developer.android.com/studio/publish/app-signing?hl=zh-cn 为应用生成签名参数
# 可直接使用 keytool -genkey -v -keystore ./upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload -keypass keypass -storepass storepass 这个命令生成签名文件
ANDROID_KEY_ALIAS= # keytool 命令执行时的 alias 参数
ANDROID_STORE_PASSWORD= # keytool 命令执行时输入的 storepass 参数
ANDROID_KEY_PASSWORD= # keytool 命令执行时输入的 keypass 参数
ANDROID_KEY_JKS= # 把生成的 jks 文件，使用 base64 编码
```

然后根据需要，执行以下构建命令，即可构建出具有签名的应用：

- Windows 构建

```powershell
pnpm dotenvx powershell .\scripts\[platform].ps1
```

- MacOS、Linux、Android、iOS 构建

```bash
pnpm dotenvx ./scripts/[platform].sh
```

### 特别说明

MacOS 与 iOS 签名相关证书以及 Provisioning Profile 文件可按照下面步骤获取：

1. 确保已经是 Apple 开发者账号，并且已经登录到 xcode 中。
2. 在 xcode 中 accounts 里面登录 Apple ID，并在 xcode 中添加需要的证书类型，然后在 xcode 中或钥匙串中导出证书为 [p12 文件](https://zh.wikipedia.org/wiki/PKCS_12)，操作步骤可参考：https://help.apple.com/xcode/mac/current/#/dev154b28f09。p12 文件包含 key(私钥) 与 cer(证书)，Apple 开发者网站只能下载证书，私钥保存在系统钥匙串中，请保管好 p12 文件，不要泄露给他人，并做好备份。

3. 证书类型说明：https://developer.apple.com/cn/help/account/reference/certificate-types。本文档在 MacOS 分发签名使用的 Developer ID Application 证书，iOS 分发签名使用的 Apple Distribution 证书。

   - Developer ID Application: 用于在 Mac App Store 以外分发 Mac App 时对其进行签名。
   - Apple Distribution: 向指定设备分发你的 iOS、macOS、Apple tvOS 或 watchOS App 以进行测试或将其提交到 App Store。
   - iOS Distribution (App Store Connect and Ad Hoc): 向指定设备分发你的 iOS、Apple tvOS 或 watchOS App 以进行测试或将其提交到 App Store。
   - Mac App Distribution: 在将 Mac App 提交到 Mac App Store 之前对其进行签名。

4. iOS 生成 Provisioning Profile 文件：https://developer.apple.com/cn/help/account/manage-provisioning-profiles/create-a-development-provisioning-profile

获取到证书文件后，base64 编码 p12 文件后，把编码的内容写入到 `.env` 文件中的 `APPLE_CERTIFICATE`或 `IOS_CERTIFICATE` 变量中。

```bash
openssl base64 -A -in <p12 文件路径> -out <p12 文件 base64 编码后的文件路径>
```

## 插件开发

项目包含三个自定义 Tauri 插件：

- **tauri-plugin-mobile**: 移动端特定功能
- **tauri-plugin-ssh**: SSH 连接功能
- **tauri-plugin-data**: 数据管理功能

要开发插件，请修改相应目录下的代码，并在需要时更新其依赖关系。

## 提交 Pull Request

1. 创建一个新的分支
2. 实现您的更改
3. 确保代码通过所有测试和检查
4. 提交您的代码，遵循提交指南
5. 创建一个 Pull Request，描述您的更改

## 报告问题

如果您发现问题，请在 GitHub 上创建一个 Issue，并尽可能详细地描述问题：

- 问题的重现步骤
- 期望的行为
- 实际的行为
- 相关的错误信息和截图
- 您的环境信息（操作系统、浏览器等）
