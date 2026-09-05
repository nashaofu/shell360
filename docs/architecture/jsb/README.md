# 移动端 JSB 架构

JSB（JavaScript Bridge）是 shell360 移动端（Android / iOS / HarmonyOS）原生 WebView 宿主与
前端之间的通信桥。Rust `jsb-core` 统一管理协议与通道收发，业务实现集中在
`shell360-runtime`，各端宿主只做传输适配（`JsbTransport`）与系统原语（`HostServices`）。

## 分层总览

```
bridge (TS)            业务调用，基于 jsb 封装
   │  jsb.invoke(method, data)
jsb (TS)               JSB 协议/通道/事件纯框架
   │  MessagePort / WKScriptMessage
各端对接层              JsbTransport + HostServices（Kotlin / Swift / ArkTS）
   │  FFI（UniFFI / NAPI）
jsb-core (Rust)        JSB 引擎纯框架          shell360-runtime (Rust) 业务后端
```

完整分层图与职责见 [`architecture.md`](./architecture.md)。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [`architecture.md`](./architecture.md) | 架构设计：分层职责、核心接口（`Jsb`/`JsbTransport`/`JsbHandler`）、消息流、平台适配、FFI 与线程、crate 边界、统一边界 |
| [`protocol.md`](./protocol.md) | 协议规范：帧信封、帧序列、错误码、方法表、帧大小限制 |
| [`adr/`](./adr/README.md) | 架构决策记录（当前有效的设计决策） |
| [`history.md`](./history.md) | 历史：被取代的设计、迁移落地记录、P0 平台漂移 |

## 真机验证状态

Rust 测试与协议黄金样例（`crates/jsb-core/tests/fixtures/current_protocol.json`）不构成端到端
设备证据。真机字节链路捕获仍待补齐：

| 平台 | 完整真机捕获 | 状态 |
| --- | --- | --- |
| Android | 否 | 未捕获 |
| iOS | 否 | 需 macOS / Xcode 与 iOS 运行时 |
| HarmonyOS | 否 | 未捕获 |

一次平台捕获被接受的条件：包含时间戳、App 构建标识、OS/WebView 版本、channel ID、有序原始文本
帧、二进制字节转储与精确复现步骤。静态测试与构建成功不能替代。捕获应存于
`captures/<platform>/<build-id>/`，含 `metadata.json`、有序 `frames.jsonl`，以及被 JSONL 记录
引用 SHA-256 的二进制负载文件。

### 环境探针（2026-09-01，Asia/Shanghai）

- Android SDK 与 `adb` 已安装，但 `adb devices -l` 无设备；模拟器工具无已配置 AVD。
- DevEco Studio 与其 SDK 已安装，但 `hdc list targets` 返回 `[Empty]`；未发现已配置的本地
  HarmonyOS 模拟器。
- 宿主机为 Windows，无 `xcrun`，无法在本机产生 iOS 运行时捕获。
