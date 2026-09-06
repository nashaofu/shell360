# 移动端原生宿主方案（归档）

本文档目录保留历史上的 iOS / HarmonyOS 联合实施方案，供追溯设计决策和迁移背景使用。

## 当前文档

- [iOS 平台说明](../platforms/ios.md)
- [HarmonyOS 平台说明](../platforms/harmonyos.md)
- [JSB 架构](../architecture/jsb/architecture.md)
- [JSB 协议](../architecture/jsb/protocol.md)
- [JSB ADR](../architecture/jsb/adr/README.md)

## 使用约束

本归档页不定义当前接口、方法名、事件格式或宿主调用方式。实现新功能时，请以当前平台文档和 JSB 架构/协议为准；历史迁移细节请查看 [JSB 历史记录](../architecture/jsb/history.md)。

当前仓库的移动端边界如下：React 负责 UI 与业务流程，`bridge/native` 提供平台无关 facade，宿主负责 WebView 生命周期与传输适配，Rust runtime 负责业务后端。控制消息与独立二进制 Channel 的细节由 JSB 当前协议统一定义。
