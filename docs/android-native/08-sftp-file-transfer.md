# P1：SFTP 和 Android 文件中转

## 目标

在 `shell360-ssh` 中提供 SFTP 能力，并通过 Android Storage Access Framework
安全地完成本地文件上传、下载和进度控制。

## 依赖

- [07-ssh-terminal.md](./07-ssh-terminal.md)
- [09-android-platform-capabilities.md](./09-android-platform-capabilities.md) 中的 FileBroker。

## SFTP 范围

- open/close。
- 目录读取。
- 创建、删除、重命名。
- exists 和 canonicalize。
- 文本文件读取和写入。
- 上传、下载、暂停、继续和取消。
- EOF、close 和 progress 事件。

## 文件边界

Android 文件选择返回 `content://`，不得作为普通路径传给 Rust。第一阶段统一使用
临时文件中转：

```text
上传:
content:// -> Kotlin copy -> cache/staging -> Rust SFTP upload

下载:
Rust SFTP download -> cache/staging -> Kotlin copy -> content://
```

前端只持有：

```text
shell360-file://<token>
```

`FileBroker` 维护 token、显示名称、临时路径、访问模式和所属 `clientId`。

## Rust API

`shell360-ssh` 不认识 Android URI 或 FileBroker token。FFI 在调用业务库前将 token
解析为受控临时路径。

业务库应将传输核心抽象为 reader/writer，路径上传下载只是 adapter，便于未来 iOS
使用相同实现而不依赖 security-scoped URL。

## 安全和清理

- staging 文件只创建在 app cache。
- 文件名不能参与未校验的路径拼接。
- token 不能访问任意 app 私有路径。
- 传输完成、取消或 client release 后删除临时文件。
- App 启动时清理超时 staging 文件。
- 临时目录不参与 Android backup。

## 进度和控制

事件：

```text
sftp.transfer.progress
sftp.transfer.completed
sftp.transfer.failed
sftp.transfer.cancelled
```

- `taskId` 在任务开始时立即返回。
- progress 限频，避免每个数据块都进入 WebView。
- pause 后不能继续增长进度。
- cancel 必须解除 pause 并尽快退出。
- task 结束后从 manager 和 FileBroker 同时清理。

## 大文件策略

第一阶段接受双倍本地 IO 和临时空间开销，以换取 Android/iOS 一致的可靠边界。
后续若大文件性能不可接受，再评估向 Rust 传递文件描述符。文件描述符方案不能在
P1 与基础迁移同时引入。

## 测试

- 空文件、小文件和大文件。
- 重名覆盖确认。
- 暂停、继续、取消和网络中断。
- App cache 空间不足。
- 用户撤销 URI 权限。
- 恶意文件名和过期 token。
- 下载完成后的内容校验和临时文件清理。

## 验收标准

- Android 可以通过系统文件选择器上传和下载。
- 文件内容不经过 JSON Bridge。
- 大文件传输期间 WebView 保持可交互。
- 取消和失败不会残留任务或长期临时文件。
- SFTP 业务库不依赖 Android、Tauri 或 FileBroker 类型。
