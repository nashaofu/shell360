# Current JSB method and error matrix

> **P0 baseline snapshot**：本表记录 P0 时期三端的方法注册与错误码漂移，属于冻结基线。当前实现中，方法表唯一来源是 `shell360-runtime::methods::method_specs()`（70 个 spec，测试断言数量），错误码由 `jsb-core`（通用框架码）与 `shell360-runtime`（业务/宿主码）统一产生，三端 transport 不再解析方法名、不做 `ssh.shell.open` 绑定（该绑定在 `shell360-runtime` 内）。最终架构见 `rust-owned-webview-transport.md` 与 `layering.md`。

## Method table

The hosts share 67 registrations across the main families: `bridge.health`; `app.getVersion`, `app.setSystemBarsAppearance`; `machineUid.getMachineUid`; `clipboard.readText`, `clipboard.writeText`; `core.openUrl`; `dialog.open`, `dialog.save`; `fs.readTextFile`, `fs.writeTextFile`; `window.close`; `keygen.generate`; 24 `data.*` methods; seven `ssh.session.*` methods; three common `ssh.shell.*` methods; 14 `ssh.sftp.*` methods; and six `ssh.portForwarding.*` methods. HarmonyOS and iOS additionally register `ssh.shell.send`; iOS alone additionally registers `core.healthCheck`.

The complete union registration list is:

```text
bridge.health
core.healthCheck
app.getVersion
app.setSystemBarsAppearance
machineUid.getMachineUid
clipboard.readText
clipboard.writeText
core.openUrl
dialog.open
dialog.save
fs.readTextFile
fs.writeTextFile
window.close
keygen.generate
data.checkIsEnableCrypto
data.checkIsInitCrypto
data.checkIsAuthed
data.initCryptoKey
data.initCryptoPassword
data.loadCryptoByPassword
data.initCryptoBiometric
data.loadCryptoByBiometric
data.changeCryptoPassword
data.changeCryptoEnable
data.resetCrypto
data.rotateCryptoKey
data.getHosts
data.addHost
data.updateHost
data.deleteHost
data.getKeys
data.addKey
data.updateKey
data.deleteKey
data.getPortForwardings
data.addPortForwarding
data.updatePortForwarding
data.deletePortForwarding
ssh.session.connect
ssh.session.authenticatePassword
ssh.session.authenticatePublicKey
ssh.session.authenticateCertificate
ssh.session.authenticateKeyboardInteractive
ssh.session.authenticateAgent
ssh.session.disconnect
ssh.shell.open
ssh.shell.send
ssh.shell.resize
ssh.shell.close
ssh.sftp.open
ssh.sftp.close
ssh.sftp.readDir
ssh.sftp.createFile
ssh.sftp.createDir
ssh.sftp.removeFile
ssh.sftp.removeDir
ssh.sftp.rename
ssh.sftp.exists
ssh.sftp.canonicalize
ssh.sftp.readTextFile
ssh.sftp.writeTextFile
ssh.sftp.uploadFile
ssh.sftp.downloadFile
ssh.portForwarding.openLocal
ssh.portForwarding.closeLocal
ssh.portForwarding.openRemote
ssh.portForwarding.closeRemote
ssh.portForwarding.openDynamic
ssh.portForwarding.closeDynamic
```

Platform presence: Android has every union item except `ssh.shell.send` and `core.healthCheck`; HarmonyOS has every item except `core.healthCheck`; iOS has all 69 items.

| Family | Android | iOS | HarmonyOS | Current owner |
| --- | --- | --- | --- | --- |
| `bridge.health` | local | local | Rust pass-through | drifted |
| `core.healthCheck` | absent | local/Rust | absent | iOS-only redundant route |
| `app.*` | Rust | Rust | Rust | Rust-owned (P3, `CARGO_PKG_VERSION`) |
| `machineUid.*` | Rust | Rust | Rust | Rust-owned (P3, `app_data_dir/machine_uid` UUID v4) |
| `clipboard.*`, `dialog.*`, `core.openUrl`, `window.close` | platform | platform | Rust-to-platform runtime | host capabilities |
| `fs.*` | platform scoped logic | local file APIs | Rust-to-platform runtime | transitional Host primitive; app-local vs scoped split pending |
| `keygen.*`, `data.*`, `ssh.*` | Rust pass-through | Rust pass-through | Rust pass-through | duplicated routing |

`ssh.shell.open` is additionally parsed in all three transport bridges to bind `dataChannelId` to `(clientId, sshShellId)`. iOS also retains the JSON/base64 `ssh.shell.send` invoke route while its normal data path is binary.

## Error and limit drift

| Condition | Android | iOS | HarmonyOS |
| --- | --- | --- | --- |
| not connected | `JSB_INVALID_MESSAGE`; “JSB is not connected.” | `JSB_NOT_CONNECTED`; same text | `JSB_INVALID_MESSAGE`; “JSB channel is not connected.” |
| malformed invoke | `JSB_INVALID_MESSAGE`; multiple reasons | `JSB_INVALID_MESSAGE`; generic | `JSB_INVALID_MESSAGE`; native `Error` text |
| missing method | `JSB_UNSUPPORTED` | `JSB_UNSUPPORTED` | `JSB_UNSUPPORTED` |
| handler failure | `JSB_NATIVE_ERROR` or structured native code | `JSB_NATIVE_ERROR` or `BridgeCallbackError` | normalized runtime error or `JSB_NATIVE_ERROR` |
| invalid channel ID | `JSB_CHANNEL_INVALID_ID` | empty ID silently ignored; otherwise unchecked | `JSB_CHANNEL_OPEN_FAILED` |
| request too large | `JSB_MESSAGE_TOO_LARGE`, defaults to 1 MiB text / 10 MiB binary; platform-configurable | no limit | no limit |
| picker/system failures | structured `BRIDGE_*` | structured `BRIDGE_*` for route validation | several raw `Error` messages |

P1 defines the canonical engine codes and messages; P0 deliberately preserves these differences.
