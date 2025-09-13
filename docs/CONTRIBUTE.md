# shell360

A cross-platform SSH and SFTP client.

## Windows

1. 安装 MSVC 最新版本的 x86，x64，arm64 的编译工具，否则不能正常交叉编译

## Android

安卓开发需要安装 Android studio，并配置环境变量，下面为 Linux 配置，Windows Mac 对应的替换相关变量和路径即可

```shell
export ANDROID_HOME="~/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/26.2.11394342"
export JAVA_HOME="/opt/android-studio/jbr"
export PATH="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"
export PATH="$ANDROID_HOME/tools/bin:$PATH"
export PATH="$ANDROID_HOME/emulator:$PATH"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export PATH="$JAVA_HOME/bin:$PATH"
```

## 签名

### Android 签名

1. 生成密钥

```shell
keytool -genkey -v -keystore ./upload-keystore.jks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload

# What is your first and last name?
#   [Unknown]:  xxx
# What is the name of your organizational unit?
#   [Unknown]:  shell360
# What is the name of your organization?
#   [Unknown]:  Shell360 CA
# What is the name of your City or Locality?
#   [Unknown]:  xxx
# What is the name of your State or Province?
#   [Unknown]:  xxx
# What is the two-letter country code for this unit?
#   [Unknown]:  CN
```

2. 创建 key.properties

```
storePassword=<password-from-previous-step>
keyPassword=<password-from-previous-step>
keyAlias=upload
storeFile=<keystore-file-location>
```

如果是在 GitHub Actions 环境，由于证书需要保持私密，不能直接上传到代码仓库，所以需要通过 secrets 来把证书传递给流水线。但是由于密钥是二进制文件，不能直接当作 secrets 使用，所以需要把密钥转换为 base64 编码，然后使用。

```shell
# 生成base64
openssl base64 -A -in keystore.jks -out keystore.txt

# 在 GitHub Actions 中使用
echo $ANDROID_KEY_JKS | base64 -di > "$(pwd)/release.jks"
```

3. 修改编译脚本`src-tauri/gen/android/app/build.gradle.kts`

   - 读取签名文件

   ```kts
   val keyPropertiesFile = rootProject.file("key.properties")
   val keyProperties = Properties().apply {
     if (keyPropertiesFile.exists()) {
         keyPropertiesFile.inputStream().use { load(it) }
     }
   }
   ```

   - 添加签名配置

   ```kts
       signingConfigs {
           create("release") {
             if (keyPropertiesFile.exists()) {
                 keyAlias = keyProperties.getProperty("keyAlias")
                 keyPassword = keyProperties.getProperty("keyPassword")
                 storeFile = file(keyProperties.getProperty("storeFile"))
                 storePassword = keyProperties.getProperty("keyPassword")
             }
           }
       }
   ```

   - 添加签名配置

   ```kts
       signingConfigs {
           create("release") {
             if (keyPropertiesFile.exists()) {
                 keyAlias = keyProperties.getProperty("keyAlias")
                 keyPassword = keyProperties.getProperty("keyPassword")
                 storeFile = file(keyProperties.getProperty("storeFile"))
                 storePassword = keyProperties.getProperty("keyPassword")
             }
           }
       }
   ```

   - 使用签名配置进行签名

   ```kts
           getByName("release") {
               isMinifyEnabled = true
               proguardFiles(
                   *fileTree(".") { include("**/*.pro") }
                       .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                       .toList().toTypedArray()
               )
               if (keyPropertiesFile.exists()) {
                   signingConfig = signingConfigs.getByName("release");
               }
           }
   ```

### MacOS 签名

MacOS 签名需要用到下面这些环境变量：

```shell
APPLE_API_ISSUER=
APPLE_API_KEY=
APPLE_API_KEY_PATH=

# 签名使用的开发者证书名称，在App store外分发，
# 所以要用Developer ID Application 证书
APPLE_SIGNING_IDENTITY=
# Developer ID Application 证书导出的 p12 文件
# 并把 p12 文件 使用 base64 编码为字符串
APPLE_CERTIFICATE=
# Developer ID Application 证书导出的 p12 的加密密码
APPLE_CERTIFICATE_PASSWORD=
```

1. 在 https://appstoreconnect.apple.com/access/integrations/api 创建 App Store Connect API API 密钥，并把`APPLE_API_ISSUER`设置为`issuer id`，`APPLE_API_KEY`设置为对应的密钥 ID，`APPLE_API_KEY_PATH`设置为下载的密钥的文件路径。如果是在 Github Action 中，还需要添加`APPLE_API_KEY_TEXT`，`APPLE_API_KEY_TEXT`为密钥的 base64 内容，在 GitHub Action 中需要把`APPLE_API_KEY_TEXT`写入到`APPLE_API_KEY_TEXT`。
2. 在 xcode 添加 Developer ID Application 证书，请注意 Developer ID Application 证书最多 5 个，然后导出证书为 p12 文件
3. 在编译环境中添加上面的环境变量，然后编译即可自动签名与公证。
4. 未签名的应用打开会是如下表现：https://support.apple.com/zh-cn/102445。 可以使用`codesign -d Shell360.app -vvv`或`codesign -d Shell360.dmg -vvv`命令查看签名信息

### iOS 签名

iOS 签名需要用到下面这些环境变量：

```shell
APPLE_API_ISSUER=
APPLE_API_KEY=
APPLE_API_KEY_PATH=

IOS_CERTIFICATE=
IOS_CERTIFICATE_PASSWORD=
IOS_MOBILE_PROVISION=
```

1. 在 https://appstoreconnect.apple.com/access/integrations/api 创建 App Store Connect API API 密钥，并把`APPLE_API_ISSUER`设置为`issuer id`，`APPLE_API_KEY`设置为对应的密钥 ID，`APPLE_API_KEY_PATH`设置为下载的密钥的文件路径。如果是在 Github Action 中，还需要添加`APPLE_API_KEY_TEXT`，`APPLE_API_KEY_TEXT`为密钥的内容。
2. 在 xcode 中导出分发用的 P12 签名证书。https://help.apple.com/xcode/mac/current/#/dev154b28f09, 并`IOS_CERTIFICATE`设置为证书转换为 base64 的字符串，`IOS_CERTIFICATE_PASSWORD`设置为导出证书时的密码。

   ```shell
   base64 -i apple-certificate.p12 > apple-certificate.txt
   ```

3. 设置`IOS_MOBILE_PROVISION`为对应应用的描述文件的 base64 字符串。
4. 编译完成后，可以使用`codesign -d Shell360.app -vvv`或`codesign -d Shell360.ipa -vvv`命令查看签名信息

### 上传到 app store connect

1. 设置好 iOS 编译环境变量，并执行`pnpm tauri ios build --export-method app-store-connect`
2. 把生成的 ipa 文件使用 transporter.app 上传到 app store connect

## 更新

1. 使用`pnpm tauri signer generate -w $HOME/.tauri/shell.key`生成 key
2. 把 key 添加到 GitHub secrets，secret 名称为`TAURI_SIGNING_PRIVATE_KEY`与`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. 在 GitHub Action 中添加环境变量

## 关于 self-host 配置

当前使用了 self-host 的 GitHub action runner，windows 下执行命令需要能正常访问 bash 命令（git-bash）,部分情况下会访问到 wsl 的 bash，所以需要确保能正确访问。同时，windows 下 action runner 安装时，使用管理员角色执行才能把 runner 安装为服务，服务用户使用能访问 bash 命令的用户。
