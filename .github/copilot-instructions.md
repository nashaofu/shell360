# Shell360 AI 代理指南

本文档旨在帮助 AI 代理快速理解和参与 Shell360 项目开发。

## 项目概述

Shell360 是一个使用 Tauri + React + Rust 构建的跨平台 SSH & SFTP 客户端，支持 Windows、macOS、Linux、Android 和 iOS。

### 核心组件

- `desktop/`: 桌面应用前端代码 (React + TypeScript)
- `mobile/`: 移动应用前端代码 (React + TypeScript)
- `shared/`: 共享组件和工具库
- `src-tauri/`: Rust 后端代码，包含主要业务逻辑
- `tauri-plugin-*/`: 自定义 Tauri 插件
  - `tauri-plugin-ssh/`: SSH 连接核心功能
  - `tauri-plugin-data/`: 数据管理和加密存储
  - `tauri-plugin-mobile/`: 移动端特定功能

### 技术架构要点

1. **前端架构**
   - 使用 React + TypeScript 构建 UI
   - 共享代码位于 `shared/` 目录
   - 遵循移动优先的响应式设计原则

2. **后端架构**
   - 核心功能通过自定义 Tauri 插件实现
   - SSH/SFTP 功能由 Rust 实现以保证性能
   - 使用加密存储保护敏感数据

3. **构建系统**
   - 使用 pnpm 管理依赖和工作区
   - 支持跨平台构建
   - 提供平台特定的签名和分发脚本

## 开发工作流

### 常用命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev            # 桌面端
pnpm tauri android dev    # Android
pnpm tauri ios dev       # iOS

# 构建
pnpm tauri build         # 桌面端
pnpm tauri android build # Android
pnpm tauri ios build    # iOS
```

### 关键文件和路径

- `package.json`: 项目配置和脚本
- `src-tauri/tauri.*.conf.json`: 平台特定配置
- `src-tauri/capabilities/`: 权限配置
- `scripts/`: 构建和部署脚本

## 编码约定

1. **类型安全**
   - 前端代码必须使用 TypeScript
   - 尽可能使用类型推导而不是 any

2. **插件开发**
   - 遵循 Tauri 插件结构
   - 在插件中实现平台特定功能

3. **状态管理**
   - 使用 React Hooks 管理状态
   - 复杂状态考虑使用状态管理库

4. **错误处理**
   - Rust 代码使用 Result 类型处理错误
   - 前端统一错误处理和展示

## 测试和部署

1. **测试要求**
   - 确保跨平台兼容性
   - 测试网络异常情况
   - 验证数据加密功能

2. **发布流程**
   - 遵循语义化版本
   - 使用平台特定签名
   - 遵循应用商店发布规范

## 注意事项

- 确保敏感数据（如 SSH 密钥）始终加密存储
- 考虑不同平台的差异性
- 保持代码模块化和可重用性
- 遵循 GPLv3 许可证要求