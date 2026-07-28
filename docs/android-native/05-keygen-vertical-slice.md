# P0：Keygen 最小垂直链路

## 目标

以依赖少、无长连接的密钥生成功能验证完整链路：

```text
React -> bridge/native -> Android WebMessage -> shell360-ffi
      -> shell360-keygen -> response -> React
```

在该链路稳定前不开始 SSH 和 data 的大规模迁移。

## 依赖

- [01-android-webview-host.md](./01-android-webview-host.md)
- [02-bridge-protocol.md](./02-bridge-protocol.md)
- [03-rust-library-boundaries.md](./03-rust-library-boundaries.md)
- [04-shell360-ffi.md](./04-shell360-ffi.md)

## Rust 方案

将当前 Tauri `generate_key` 的纯业务实现提取到 `shell360-keygen`：

```text
GenerateKeyOptions -> generate_key() -> GeneratedKey
```

支持范围保持与现有 UI 一致，不在迁移阶段新增算法。

`src-tauri` 命令改为调用 `shell360-keygen`，确保桌面和 Android 共用实现。

## Bridge 命令

```text
keygen.generate
```

请求和返回字段保持现有 `bridge/core` 的 `GenerateKeyOptions` 与 `GeneratedKey`
语义，避免改动业务页面。

## 测试

- `shell360-keygen` 对每种现有算法增加单元测试。
- FFI 测试成功、无效算法、无效位数和 passphrase。
- Android Bridge 测试并发生成和错误返回。
- React 页面验证生成结果可以继续调用 data 的 `addKey`；P0 阶段可先只展示结果，
  data 接入后再完成保存。

## 验收标准

- Android Generate Key 页面可通过 Rust 生成密钥。
- 相同输入约束在桌面和 Android 上保持一致。
- Native 不包含密钥生成实现。
- 错误通过标准 Bridge error 返回，不产生未完成 Promise。
- 该功能不依赖 Tauri Android。
