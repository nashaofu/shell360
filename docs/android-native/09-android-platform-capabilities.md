# P1：Android 平台能力

## 目标

由 Kotlin 实现无法或不应进入 Rust 的 Android 平台能力，并通过
`bridge/native` 保持现有前端调用方式。

## 依赖

- [01-android-webview-host.md](./01-android-webview-host.md)
- [02-bridge-protocol.md](./02-bridge-protocol.md)

## 能力分配

| Bridge 能力 | Android 实现 |
| --- | --- |
| `app.getVersion` | PackageManager |
| `machineUid.getMachineUid` | 应用安装级随机 ID |
| `core.openUrl` | `Intent.ACTION_VIEW` |
| `dialog.open/save` | Storage Access Framework |
| `dialog.ask` | Compose/原生确认弹窗 |
| `fs.readTextFile/writeTextFile` | FileBroker 或 app 私有目录 |
| `window.close` | `Activity.finish()` |
| `clipboard.read/write` | ClipboardManager |
| `store` | 仅保留非 data 配置，使用 DataStore |
| `process.relaunch` | Activity 重建或明确不支持 |
| `updater` | Play 发布模式下不支持应用内自更新 |
| `pty` | Android 不支持 |

## FileBroker

`dialog.open/save` 不返回真实路径，返回不透明 token。`fs` 根据 token 读取或写入
ContentResolver；AppLocalData 文件则由明确的逻辑路径映射到私有目录。

FileBroker 必须：

- token 绑定 `clientId`。
- 区分 read/write 权限。
- 阻止目录穿越。
- 支持主动释放和页面释放。
- 为 SFTP 提供 staging copy。

## Store 边界

加密状态和 data 配置归 `shell360-data` 管理。Android DataStore 只保存纯平台或 UI
配置，不能成为 Host、Key 或 crypto 状态的第二事实来源。

## Machine UID

不使用硬件标识符。首次启动生成随机 UUID 并保存在应用私有配置中：

- 卸载后允许变化。
- 不请求设备标识权限。
- 恢复备份是否保留需要与隐私策略一致。

## 不支持能力

Android Backend 对以下能力返回稳定错误，而不是空实现：

```text
PLATFORM_PTY_UNSUPPORTED
PLATFORM_UPDATER_UNSUPPORTED
PLATFORM_RELAUNCH_UNSUPPORTED（若未实现）
```

前端应根据平台能力隐藏不可用入口。后续可为 `BridgeBackend` 增加 capabilities 查询，
避免通过捕获异常判断能力。

## Activity Result

文件选择器属于异步 Activity Result：

- 每个请求关联 Bridge request ID。
- Activity 重建后恢复或明确取消 pending 请求。
- 同一时间限制冲突的文件选择请求。
- 用户取消返回正常的 `null`，不是错误。

## 测试

- 打开、保存、取消和权限撤销。
- 剪贴板空内容和写入。
- 外部 URL 白名单和非法 scheme。
- App 版本、安装级 ID 持久化。
- 关闭 Activity。
- 不支持能力的稳定错误码。

## 验收标准

- 导入、导出、known_hosts 编辑和 SFTP 文件选择可用。
- 前端无法通过 token 访问任意文件。
- data 和 crypto 状态不存入 Android DataStore。
- Android 不展示 PTY 和应用内 updater 入口。
- 所有 Activity Result 请求都能完成、取消或超时，不会永久 pending。
