# P1：SSH Session 和终端

## 目标

将 SSH Session、认证和远程 Shell 提取到 `shell360-ssh`，在 Android WebView
中提供稳定的交互式终端。

## 依赖

- P0 全部方案。
- [06-data.md](./06-data.md) 提供 Host 和 Key 数据；SSH 库本身不依赖 data。

## shell360-ssh 范围

- 直接连接和跳板机连接。
- Server key 校验和 known_hosts。
- Password、PublicKey、Certificate、KeyboardInteractive 认证。
- 远程 Shell open/send/resize/close。
- disconnect、EOF、close 和 shell data 事件。

Agent 认证属于桌面能力。Android 第一版应返回 `SSH_AGENT_UNSUPPORTED`，不扫描
Android 文件系统中的 agent socket。

## 去除 Tauri 耦合

- `SSHManager<R>` 改为不带 Runtime 泛型的 `SshService`。
- Tauri `Channel` 改为 `SshEventSink`。
- `AppHandle.state()` 改为 service 内部持有 manager state。
- known_hosts 路径由初始化参数提供。
- 异步任务使用调用方 runtime，不调用 Tauri async runtime。

Tauri 插件保留命令注册，并把 `SshEvent` 转发到原有 Tauri Channel。

## 资源所有权

所有对象使用稳定 ID：

```text
clientId
  └── sessionId
      ├── shellId
      ├── sftpId
      └── portForwardingId
```

- 页面释放时关闭其拥有的资源。
- Session 断开时级联清理 Shell、SFTP 和端口转发。
- 重复 close 必须幂等。
- FFI 不向 Kotlin 暴露 Rust 指针。

## 终端事件

```text
ssh.session.disconnect
ssh.shell.data
ssh.shell.eof
ssh.shell.close
```

终端数据策略：

- Rust 侧使用有界队列。
- 16ms 或 32KB 批量发送。
- P1 使用 Base64。
- 事件携带 sequence，前端按顺序处理。
- resize 可合并，只处理最新尺寸。
- send 不应为每个按键创建重量级线程或 runtime task。

## Android 生命周期

- Activity 重建不主动断开 Session。
- WebView reload 释放旧 `clientId` 的连接，避免 HMR 泄漏。
- App 进入后台时保持现有连接，但需要记录系统网络切换产生的断线。
- Android Doze 和长期后台连接保证不在 P1 范围；需要常驻连接时另行设计前台服务。

## 测试

- 密码、公钥、证书和 keyboard-interactive。
- 未知 server key 的 continue 和 add-and-continue。
- 跳板机级联连接和断开。
- 大量终端输出下的事件顺序和内存上限。
- 快速 resize、send 和 close 竞争。
- 页面 reload 后连接清理。

## 验收标准

- Android 可以完成连接、认证并打开交互式 Shell。
- 终端输入、输出和 resize 正常。
- 未知主机密钥流程可用并可持久化。
- 网络断开能够通知前端并释放资源。
- 连续大输出不会无限增加 Native 或 WebView 内存。
- 桌面 Tauri SSH 行为保持兼容。
