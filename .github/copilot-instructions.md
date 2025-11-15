# Shell360 AI 代理指南

快速参考指南，帮助 AI 代理在 Shell360 项目中快速提高生产力。

## 架构概览

Shell360 采用 **Tauri + monorepo** 架构，跨平台支持 Windows、macOS、Linux、Android 和 iOS。

```
Frontend (React+TS)     Backend (Rust+Tauri)
┌─────────────────┐     ┌──────────────────┐
│ desktop/        │     │ src-tauri/       │
│ mobile/         │────▶│ - command.rs     │
│ shared/         │     │ - lib.rs         │
└─────────────────┘     └──────────────────┘
                               │
                        Tauri Plugins
                        ├─ tauri-plugin-ssh
                        ├─ tauri-plugin-data
                        └─ tauri-plugin-mobile
```

## 关键通信模式

**前后端通信**：通过 Tauri `invoke` 命令调用 Rust 函数
- 前端：`invoke('command_name', args)`
- 后端：`#[tauri::command]` 标记的异步函数
- 特例：IPC 通道用于长连接（SSH shell、SFTP）

**插件初始化链**（`src-tauri/src/lib.rs`）：
1. `tauri::Builder` 加载所有插件
2. 插件 `init()` 返回 `TauriPlugin<R>`
3. `setup()` 中通过 `app.manage()` 注册 Manager 实例
4. 前端通过 `invoke()` 调用插件命令

## 项目结构详解

| 目录 | 用途 | 关键文件 |
|------|------|---------|
| `desktop/` | 桌面 UI (React+Rsbuild) | `src/App.tsx`、`atom/*.ts` |
| `mobile/` | 移动 UI (React+Rsbuild) | 同桌面，平台优化 |
| `shared/` | 共享组件/库 (rslib) | `src/components/`、`src/utils/` |
| `src-tauri/src/` | Tauri 主程序 | `lib.rs`、`command.rs`、`error.rs` |
| `tauri-plugin-ssh/src/` | SSH 核心 | `ssh_manager.rs`、`commands/*` |
| `tauri-plugin-data/src/` | 加密存储 + 数据库 | `data_manager.rs`、`crypto_manager.rs` |

## 核心技术栈选型原因

- **Jotai（原子状态）** 而非 Redux：轻量级、粒度细、支持异步
- **Rsbuild** 而非 Vite：更好的 Tauri 集成、更快构建
- **Sea ORM + SQLite**：跨平台一致性、类型安全的数据库操作
- **ssh-key crate**：支持 Ed25519、RSA、ECDSA 密钥生成和加密

## 开发工作流

### 启动开发环境
```bash
pnpm install                # 首次安装，会自动构建 shared
pnpm tauri dev             # 桌面开发（带热更新）
```

### 调试技巧
- **Rust 后端错误**：`src-tauri/src/error.rs` 的 `Shell360Error` 会自动序列化为 JSON 返回前端
- **前端日志**：桌面开发时自动打开 DevTools（`src-tauri/src/lib.rs` 第 35-38 行）
- **IPC 通道数据**：查看 `tauri-plugin-ssh/ts/session.ts` 了解如何处理长连接

### 编码规范

**TypeScript**：
- 导入顺序：`builtin` → `external` → `internal` → `parent` → `sibling`（`eslint.config.js`）
- 不使用 `any`，优先类型推导
- 前端状态管理用 Jotai atoms（参考 `desktop/src/atom/`）

**Rust**：
- 使用 `Shell360Result<T>` 而非裸 `Result`（统一错误处理）
- 异步函数使用 `#[tauri::command]`
- 插件数据结构用 `Mutex<HashMap<Id, Data>>`（参考 `SSHManager`）

**共享代码**：
- `shared/` 编译为 ESM，被 `desktop`/`mobile` 导入
- 不依赖 Tauri API（在 `shared/` 中导入会导致编译失败）
- 将 Tauri 相关逻辑放在 `desktop/src/`

## 敏感数据处理

- **SSH 密钥**：生成时（`src-tauri/src/command.rs`）支持可选密码加密
- **应用数据**：存储在 `tauri-plugin-data` 中，自动加密（`crypto_manager.rs`）
- **密码**：不直接存储，使用生物识别或密钥派生

## 常见开发场景

**添加新的 SSH 命令**：
1. Rust: 在 `tauri-plugin-ssh/src/commands/*.rs` 添加函数
2. 注册：在 `tauri-plugin-ssh/src/lib.rs` 的 `invoke_handler!` 宏中添加
3. TypeScript: 在 `tauri-plugin-ssh/ts/*.ts` 导出函数包装

**新增数据存储字段**：
1. `tauri-plugin-data/src/entities/` 定义 Sea ORM 实体
2. `tauri-plugin-data/src/migration/` 新增迁移脚本
3. `tauri-plugin-data/src/commands/` 实现 CRUD 操作

**跨平台差异处理**：
- 条件编译：`#[cfg(desktop)]`、`#[cfg(mobile)]`（Rust）
- 运行时检查：`import.meta.env.TAURI_PLATFORM`（TypeScript）

## 构建与部署

- **开发**：`pnpm tauri dev`
- **本地构建**：`pnpm tauri build`
- **发布构建**：使用 `.env` 文件配置签名密钥，运行 `scripts/{platform}.{sh,ps1}`
- **App 更新**：配置在 `src-tauri/tauri.conf.json` 的 `updater.endpoints`

## 许可证 & 约束

- GPLv3：修改需开源
- 避免闭源依赖或专有算法
