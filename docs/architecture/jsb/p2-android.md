# P2 Android host migration

> **已过时（superseded）**：本文记录的三端驱动 `NativeJsbEngine` / `jsb_engine_*` 并解释输出列表的模型已被删除。当前 Android 实现以 `rust-owned-webview-transport.md` 为准：`JsbPortBridge` 实现 UniFFI `JsbTransport` callback，Rust 通过 transport 直接写回 Channel，不再有 `executeOutputs`。本文仅作为迁移历史保留。

## Change list

- Replaced the Android dispatcher, route table, and channel manager with `JsbPortBridge`.
- Added `PlatformHostServices` for Android system primitives only.
- Routed text frames, binary frames, channel lifecycle, Rust events, and shell bytes through `NativeJsbEngine`.
- Removed Android-side shell binding and all parsing of `ssh.shell.open` parameters.
- Preserved the existing WebView capability checks, origin allowlist, navigation policy, machine ID storage, app-local file boundary, scoped URI handling, reset behavior, and system-bar/window callbacks.
- Kept the separately staged mobile Back-navigation changes intact.

## Compatibility mapping

| Previous Android path | Engine path | Behavior |
| --- | --- | --- |
| `Jsb.dispatch` plus `registerAndroidRoutes` | `JsbEngine.on_control_frame` | Same invoke response envelope; routing is Rust-owned |
| `WebViewBridge` channel map | `JsbPortBridge` plus engine channel state | Same transferred WebMessagePort and binary support |
| `bindShellChannel` | Engine `(clientId, shellId) -> channelId` binding | Same targeted shell byte delivery without host business parsing |
| `AndroidBridgeServices` | `PlatformHostServices` | Same Android system calls; errors are returned to the Rust envelope builder |
| Android scoped SFTP route branches | Engine HostCall orchestration | Same URI-to-staging transfer with the business invoke owned by Rust |

## Verification

- Rust unit and golden replay tests pass for `jsb-core`.
- UniFFI unit tests pass for `shell360-ffi`.
- Android debug Kotlin and instrumentation-test sources compile.
- The repository Android runner produced both `app-debug.apk` and `app-debug.aab`, including arm64 and x86_64 Rust libraries.
- Structural scans find no Android dispatcher/route-table references, `bindShellChannel`, shell binding map, or `ssh.`/`data.` business method strings in the Android host bridge.

## Not yet claimed

- No Android device was attached for this change, so the full authentication, shell, SFTP, data, platform primitive, lifecycle, and WebView-provider smoke matrix remains pending device execution.
- P0 device-captured byte-for-byte frame evidence is still unavailable. Rust golden replay and build success are not substitutes for that evidence.
- iOS and HarmonyOS remain on their compatibility paths and must be migrated in separate P2 changes.
