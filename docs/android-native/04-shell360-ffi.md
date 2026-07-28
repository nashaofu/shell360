# P0：shell360-ffi

## 目标

建立 Android 和未来 iOS 共用的 Rust FFI 入口，连接独立业务库，但不在 FFI
层实现业务逻辑。

## 依赖

- [02-bridge-protocol.md](./02-bridge-protocol.md)
- [03-rust-library-boundaries.md](./03-rust-library-boundaries.md)

## Crate 配置

```text
crates/shell360-ffi/
├── Cargo.toml
├── build.rs
├── uniffi.toml
└── src/
    ├── lib.rs
    ├── runtime.rs
    ├── event.rs
    ├── ssh.rs
    ├── data.rs
    └── keygen.rs
```

产物支持：

```toml
[lib]
crate-type = ["cdylib", "staticlib"]
```

Feature 规划：

```text
default = ssh + data + keygen
pty     = 可选，仅未来确有桌面 FFI 需求时启用
```

Android 和 iOS 构建不启用 `pty`。

## FFI 对象

建议导出单个生命周期入口和分领域服务句柄：

```text
Shell360Runtime
├── ssh_service()
├── data_service()
├── keygen_service()
├── release_client(clientId)
└── shutdown()
```

`Shell360Runtime` 负责：

- 初始化共享 Tokio runtime。
- 根据平台传入的 app data/cache 路径初始化服务。
- 注册事件 sink。
- 记录 FFI 生命周期和页面 client 所属资源。

它不负责 Host 到 SSH 参数的业务拼装，该逻辑继续位于前端共享层。

## 调用模型

Bridge 使用 JSON 协议，但 Rust 业务库保持强类型。FFI 层可以按领域接收协议 payload，
完成一次明确反序列化后调用强类型 API：

```text
invoke_ssh(method, params_json)
invoke_data(method, params_json)
generate_key(options_json)
```

不允许把任意 method 反射执行到 Rust 对象。每个领域使用显式 match 和命令白名单。

## 事件模型

统一回调：

```text
on_event(event_json)
```

事件必须包含：

- `clientId`
- `event`
- `targetId`
- `sequence`
- `payload`

Shell 数据通过有界队列进入 FFI event sink。Kotlin 回调不能阻塞 Rust 网络任务。

## Android 构建

- 使用 `cargo-ndk` 构建 Android 动态库。
- P0 支持 `arm64-v8a` 和 `x86_64`。
- Release 是否增加 `armeabi-v7a` 在包体评估后决定。
- Gradle 任务输出到 build 目录，再作为 `jniLibs` 输入，不提交 `.so`。
- UniFFI 生成 Kotlin binding 到 Gradle generated source 目录。
- Debug 保留 Rust 符号，Release 执行 strip。

## 初始化参数

Android 必须显式传入：

```text
appDataDir
cacheDir
logLevel
eventSink
```

Rust 不获取 Android Context，不通过 JNI 自行查找目录。

## 线程和生命周期

- FFI 初始化在 Application 级别完成一次。
- Activity 重建不销毁 Rust runtime。
- WebView reload 调用 `release_client`，只释放该页面创建的资源。
- App 主动退出时执行 `shutdown`。
- 所有 FFI 方法都要捕获 panic 并转换为稳定错误，禁止 unwind 穿过 FFI。

## 实施步骤

1. 建立空 FFI crate 和 Android 构建任务。
2. 导出 runtime 初始化、health check 和 shutdown。
3. 接入事件 sink。
4. 用 keygen 验证参数、返回值和错误。
5. 增加 client 资源所有权。
6. 接入 data 和 SSH 服务。

## 验收标准

- Android 能加载 `libshell360_ffi.so`。
- FFI runtime 在 Activity 重建后保持单实例。
- Rust 错误和 panic 不会导致 Android 进程无响应。
- 页面 reload 后旧 client 资源可释放。
- FFI crate 中不存在 SSH、data 或 keygen 的业务实现副本。
