# P1：Data、SQLite 和加密

## 目标

将数据和加密实现提取到独立 `shell360-data`，让 Android 通过
`shell360-ffi` 使用与桌面一致的数据模型和 migration。

## 依赖

- P0 全部方案。

## 实施状态

截至 2026-07-29，本方案已落地：

- `shell360-data` 已从 Tauri 插件提取，桌面插件和 Android FFI 复用同一套模型、
  migration、SQLite 和加密实现。
- `bridge/native` 已映射全部 `data.*` API 和认证状态事件。
- FFI data 错误携带稳定 `code` 和 `reason`，Android Bridge 保留业务错误码。
- `resetCrypto` 关闭数据库并返回 `restartRequired`；Android 回复请求后结束应用进程，
  下次启动时重建 data service。
- 生物识别和密钥轮换分别返回 `CRYPTO_BIOMETRIC_UNSUPPORTED` 和
  `CRYPTO_KEY_ROTATION_UNSUPPORTED`。

## 范围

- Host CRUD。
- Key CRUD。
- PortForwarding 配置 CRUD。
- SQLite 初始化和 migration。
- 密码加密初始化、解锁、修改密码、启停加密和重置。
- 认证状态查询和变更事件。

生物识别不在本阶段实现，相关方法应返回明确的
`CRYPTO_BIOMETRIC_UNSUPPORTED`，不能保留 panic 或 `unimplemented!()`。

## shell360-data 改造

移除：

- `AppHandle` 和 `State`。
- Tauri Store。
- Tauri event emitter。
- 通过 Tauri API 获取数据库路径和重启应用。

改为显式初始化：

```text
DataService::open(DataOptions {
  database_path,
  config_path,
  event_sink,
})
```

认证状态通过 `DataEventSink` 发出，数据库和配置存储由 Rust 管理，避免前端
`LazyStore` 与 Rust CryptoManager 各自维护 `crypto_enable`。

## 前端调整

- `bridge/data` 公共 API 保持不变。
- `bridge/native/data` 映射 `data.*` 命令。
- 移动端 `cryptoIsEnableAtom` 攄为调用 `checkIsEnableCrypto()` 并监听 data 事件。
- 不再通过 `bridge/store` 读取加密状态。

## Android 路径

建议：

```text
filesDir/shell360/data.db
filesDir/shell360/config.json
filesDir/shell360/known_hosts
```

敏感数据不放入 cache。备份策略需要明确排除数据库、配置和临时明文文件，除非后续
设计了端到端安全备份。

## 重置行为

`resetCrypto` 由 Rust 完成关闭数据库和删除数据，返回 `restartRequired`。Android
收到后重建 Activity 或结束进程，不允许 Rust 直接调用平台重启 API。

## 数据迁移

- 继续使用现有 Sea ORM migration。
- Android 首次接入没有 Tauri 数据迁移要求，因为使用独立原生工程。
- 若需要兼容已发布 Tauri Android 用户，应另立数据导入方案，不能假设两个应用目录
  可直接互访。

## 测试

- 临时目录中的数据库初始化和升级。
- 开关加密前后的数据可读性。
- 密码错误、修改密码和重置。
- Host/Key 引用完整性。
- 并发查询和关闭数据库。
- Android 进程重启后的数据持久化。

## 验收标准

- Android 可以新增、更新、删除和重新加载 Host、Key、PortForwarding 配置。
- 加密状态只有 Rust data service 一个事实来源。
- 锁定状态下敏感数据不可读取。
- 删除或重置数据库不会留下已打开连接。
- 桌面 Tauri data 插件继续通过同一个 `shell360-data` 工作。
