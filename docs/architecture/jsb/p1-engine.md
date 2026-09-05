# P1 JsbEngine implementation

> **已过时（superseded）**：本文记录的 `JsbEngine` + `Vec<EngineOutput>` + `InvokeFlow::Delegate` 模型已被删除。当前实现以 `rust-owned-webview-transport.md` 为准：`jsb-core::Jsb` 通过注入的 `JsbTransport` 直接收发 WebView Channel，具体方法由 `shell360-runtime` 的 `JsbHandler` 实现。本文仅作为迁移历史保留。

## Implemented

- `jsb-core::JsbEngine` owns UUID/channel state, the first/last channel client lifecycle, configurable frame limits (default 1 MiB text and 10 MiB binary), invoke validation, the 69-method union table, pending HostCalls, unified response envelopes, control-channel events, and `(clientId, sshShellId) -> dataChannelId` binary routing.
- `MethodInvoker` keeps `jsb-core` independent of the application crate. `shell360-runtime` implements it with the existing `Shell360Runtime`; SSH/data/keygen code is not duplicated.
- **Updated (2026-09-03)**: Rust/Host routing is no longer a static classification inside the engine. `MethodInvoker::invoke` returns `InvokeFlow::Complete(outcome)` or `InvokeFlow::Delegate { primitive, params_json, continuation }`, where the primitive and optional continuation are opaque to the engine. Shell channel bindings and scoped-file staging live in `shell360-runtime`; `jsb-core` only resumes or cancels opaque continuations.
- UniFFI exposes `NativeJsbEngine`, `NativeEngineOutput`, and the asynchronous `HostServices.onHostCall` delivery boundary. A HostCall is delivered once through the callback; `completeHostCall` returns the resulting reply output.
- OHRS exposes matching channel-open, channel-close, control-frame, binary-frame, and HostCall-completion functions. HostCalls use a thread-safe callback.
- The legacy Registry/Connection and OHRS register/connect/dispatch/resolve/reject/close exports were compatibility-only and have been removed now that all three hosts run `JsbEngine` (P2 cleanup complete).

## Deliberately deferred

- No Android, iOS, or HarmonyOS host calls the engine yet.
- `app.getVersion` and `machineUid.getMachineUid` have moved back to Rust (P3): the version is `env!("CARGO_PKG_VERSION")` and the machine UID is a UUID v4 persisted at `app_data_dir/machine_uid`. Their transitional `GetAppVersion`/`GetMachineUid` Host primitives are removed. The legacy per-host machine UID values still need a one-time migration read.
- app-local `fs` remains a transitional Host primitive: `fs.readTextFile`/`writeTextFile` carry both app-local (known_hosts) and scoped URI (import/export/add-key) semantics, so moving the method to Rust requires first splitting those two paths at the business layer.
- Scoped SFTP upload/download is orchestrated by the engine around `readScopedFile`/`writeScopedFile`. The host only moves bytes between a user-authorized URI and an engine-managed staging path.
- `core.healthCheck` and JSON `ssh.shell.send` remain in the union table until P3 validates the iOS binary path and chooses removal or cross-platform alignment.
- Generated TypeScript text is deterministic and tested through `method_typescript`; the checked-in declaration is consumed by `bridge/native`, while generic `jsb` continues to accept opaque method strings.
- P0 device captures remain missing. Rust replay and host builds are not presented as device evidence.
