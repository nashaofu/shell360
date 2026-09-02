# P1 JsbEngine implementation

## Implemented

- `jsb-core::JsbEngine` owns UUID/channel state, the first/last channel client lifecycle, the 1 MiB text and binary frame limit, invoke validation, the 69-method union table, Rust/Host routing, pending HostCalls, unified response envelopes, control-channel events, and `(clientId, sshShellId) -> dataChannelId` binary routing.
- `RustMethodInvoker` keeps `jsb-core` independent of the application crate. `shell360-ffi` implements it with the existing `Shell360Runtime`; SSH/data/keygen code is not duplicated.
- UniFFI exposes `NativeJsbEngine`, `NativeEngineOutput`, and the asynchronous `HostServices.onHostCall` delivery boundary. A HostCall is delivered once through the callback; `completeHostCall` returns the resulting reply output.
- OHRS exposes matching channel-open, channel-close, control-frame, binary-frame, and HostCall-completion functions. HostCalls use a thread-safe callback.
- Existing Registry/Connection and OHRS register/connect/dispatch/resolve/reject/close exports remain available for the three unchanged hosts during P2 migration. They are compatibility-only and scheduled for removal after all three hosts switch.

## Deliberately deferred

- No Android, iOS, or HarmonyOS host calls the engine yet.
- `machineUid` and app-local `fs` retain their existing runtime behavior until P3. During the per-host P2 migration they are represented as transitional Host primitives so a host can switch to `JsbEngine` without changing persistence or path behavior; P3 removes those primitives after Rust takes ownership.
- Scoped SFTP upload/download is orchestrated by the engine around `readScopedFile`/`writeScopedFile`. The host only moves bytes between a user-authorized URI and an engine-managed staging path.
- `core.healthCheck` and JSON `ssh.shell.send` remain in the union table until P3 validates the iOS binary path and chooses removal or cross-platform alignment.
- Generated TypeScript text is deterministic and tested through `method_typescript`; wiring the generated declaration into `jsb/` belongs to P4.
- P0 device captures remain missing. Rust replay and host builds are not presented as device evidence.
