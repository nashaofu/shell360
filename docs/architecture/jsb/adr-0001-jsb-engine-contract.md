# ADR-0001: JsbEngine contract and method-table design

> **Superseded**：本 ADR 记录的 `JsbEngine` + `Vec<EngineOutput>` + 输出解释契约已被删除并由 `rust-owned-webview-transport.md` 取代。当前实现中 `jsb-core::Jsb` 通过注入的 `JsbTransport` 直接收发 WebView Channel，入口只返回 `Result<(), JsbError>`；具体方法由 `shell360-runtime` 通过 `JsbHandler` 实现。本文仅作为决策历史保留。

Status: Superseded by `rust-owned-webview-transport.md` (was: Accepted for P1 implementation).

## Decision

`jsb-core::JsbEngine` is the sole transport-independent owner of method routing, invoke validation, pending requests, response/error envelopes, events, logical channel bindings, the 1 MiB frame limit, UUID validation, and first/last channel client lifecycle.

Inputs are `on_control_frame(channel_id, text)`, `on_binary_frame(channel_id, bytes)`, `on_channel_open(channel_id)`, `on_channel_close(channel_id)`, and `complete_host_call(call_id, result_json)`. Every input returns an ordered `Vec<EngineOutput>`.

Outputs are `ReplyText`, `PushBinary`, `OpenChannel`, `FailChannel`, `ClosePort`, and `HostCall`. Host execution must preserve vector order and must not inspect business method names or payload fields.

The declarative Rust method table records dotted-camel method name, `Rust` or `Host` kind, Rust handler or host primitive, events, binary behavior, error domain, and capability metadata. It drives routing, binding export lists, generated TypeScript method-name declarations, and contract-case generation.

Channel IDs are RFC 4122 UUID strings. Text input is rejected above 1 MiB before JSON parsing. Binary input uses the same 1 MiB per-frame limit. Deterministic tests inject the client/call ID source; production IDs remain UUIDs.

## Compatibility decision

P1 adds the engine entrypoints while retaining the current `NativeJsbRegistry`/`NativeJsbConnection` and OHRS register/connect/dispatch/resolve/reject API for one version. P2 removes each platform's use of the legacy API independently. Removal of exported legacy bindings occurs only after all three hosts have migrated.

## Consequences

WebView hosts become instruction executors. A new Rust method changes only the Rust table; a new host method also adds one primitive implementation per platform. The Tauri backend and `bridge/src/tauri.ts` are outside this decision and remain behaviorally unchanged.
