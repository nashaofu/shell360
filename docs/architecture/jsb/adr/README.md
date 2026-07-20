# 架构决策记录（ADR）

本目录记录 JSB 架构中**当前有效**的设计决策。ADR（Architecture Decision Record）用于说明
“为什么这么设计”，记录决策的背景、决定与后果。

命名约定：`NNNN-<slug>.md`，编号一旦分配不复用。被取代的 ADR 不删除编号，移入
`../history.md` 归档。

## 索引

| 编号 | 标题 | 状态 |
| --- | --- | --- |
| [0002](./0002-host-services.md) | HostServices primitive boundary | Accepted |
| [0003](./0003-typescript-adaptation.md) | TypeScript adaptation boundary | Accepted |
| [0004](./0004-back-press-layering.md) | Route native back-press through the bridge capability layer | Accepted |

ADR-0001（`JsbEngine` contract and method-table design）已被
[`rust-owned` 直连 transport 架构](../architecture.md)取代，归档于 [`../history.md`](../history.md)。
