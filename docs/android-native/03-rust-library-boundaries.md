# P0：Rust 业务库边�?

## 目标

将现�?Tauri 插件中的业务实现提取为独�?Rust 库，同时保持桌面 Tauri 功能可用�?
避免形成包含所有业务的单一 core crate�?

## 目标结构

```text
crates/
├── shell360-ssh/
�?#8203;─&#8203;─ shell360-store/
├── shell360-pty/
├── shell360-keygen/
└── shell360-ffi/
```

依赖关系�?

```text
tauri-plugin-ssh  --> shell360-ssh
tauri-plugin-data --> shell360-store
tauri-plugin-pty  --> shell360-pty

shell360-ffi --> shell360-ssh
             --> shell360-store
             --> shell360-keygen
             --> shell360-pty（可�?desktop feature�?
```

## 边界约束

### shell360-ssh

包含 SSH Session、认证、Shell、SFTP、端口转发、known_hosts 和传输任务控制�?

不得依赖�?

- Tauri Runtime、AppHandle、State、Channel�?
- 数据库和 `shell360-store`�?
- Android、JNI �?UniFFI�?

路径、事件和任务执行器通过构造参数或 trait 注入�?

### shell360-store

包含 Sea ORM、SQLite migration、Host/Key/PortForwarding CRUD 和数据加密�?

不得依赖�?

- SSH �?PTY�?
- Tauri Store、AppHandle 和事件系统�?
- Android KeyStore 等具体平�?API�?

数据库目录、配置目录和认证状态事件通过明确接口提供�?

### shell360-pty

包含本地 PTY 进程、输入输出、resize 和退出管理，只服务支�?PTY 的桌面平台�?

不得依赖�?

- SSH、data �?FFI�?
- Tauri Channel�?
- Android/iOS API�?

### shell360-keygen

只包含密钥生成与编码逻辑，不依赖 UI、数据库和平台运行时�?

### shell360-ffi

只包含：

- UniFFI 导出�?
- 共享异步运行时�?
- 服务初始化和生命周期�?
- FFI 参数与业务类型转换�?
- 事件回调转发�?

不得复制业务规则，也不得成为业务模块之间的共享状态容器�?

## 提取策略

采用“先提取、后适配”：

1. 在新业务库中建立�?Tauri 的公开 API�?
2. 将现有实现迁移到业务库�?
3. �?`tauri-plugin-*` 调用业务库�?
4. 桌面回归通过后再�?`shell360-ffi` 调用同一业务库�?

不采用一次性删�?Tauri 插件的方式，避免同时破坏桌面和移动端�?

## 共享类型原则

- 领域类型留在各自业务库�?
- 不创建大而全�?`shell360-core` 或公�?`types` crate�?
- 只有出现两个以上 crate 必须共享且语义稳定的基础类型时，才考虑小型公共 crate�?
- FFI �?Tauri adapter 各自负责边界类型转换�?

## 异步运行�?

- 业务库只暴露 async API，不自行创建全局 Tokio runtime�?
- Tauri 使用现有异步 runtime 调用�?
- `shell360-ffi` �?Android/iOS 持有一个共�?runtime�?
- 禁止 SSH �?data 各自创建独立全局 runtime�?

## 测试要求

- 每个业务库具有独立单元测试�?
- Tauri adapter 测试参数和事件转换�?
- FFI 测试生命周期和错误转换�?
- SSH 集成测试不得依赖 WebView�?
- Data migration 测试使用临时目录和独立数据库�?

## 验收标准

- 四个业务库均可在没有 Tauri 依赖的情况下编译�?
- Tauri 插件只保留命令注册、状态接入和类型转换�?
- Android 构建不编�?`tauri-plugin-*`�?
- `shell360-ssh` �?`shell360-store` 不存在相互依赖�?
- 桌面功能在提取后保持现有行为�?
