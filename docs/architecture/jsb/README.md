# JSB architecture baseline

This directory freezes the P0 protocol baseline. The runtime model that freezes it is `jsb-core::Jsb` (renamed from the interim `JsbEngine`; see `rust-owned-webview-transport.md`).

- `current-protocol.md` records the repository-derived frame sequence and the evidence status.
- `method-error-matrix.md` records the current method families and platform drift.
- `adr-0001-jsb-engine-contract.md` recorded the interim engine/output-list contract and is superseded by `rust-owned-webview-transport.md`.
- `adr-0002-host-services.md` fixes the host primitive boundary.
- `adr-0003-typescript-adaptation.md` bounds TypeScript and business-layer changes.
- `p1-engine.md` records the interim P1 compatibility surface and is superseded by `rust-owned-webview-transport.md`.
- `rust-owned-webview-transport.md` is the current architecture: Rust owns JSB channel I/O through an injected `JsbTransport`, while all concrete methods stay in `shell360-runtime`.

The executable copy of the current frame fixture is
`crates/jsb-core/tests/fixtures/current_protocol.json`. It is a static baseline reconstructed from source, not a device capture.

## Device evidence status

| Platform | Complete device capture | Status |
| --- | --- | --- |
| Android | No | Not captured in P0 workspace session |
| iOS | No | Requires macOS/Xcode and an iOS runtime |
| HarmonyOS | No | Not captured in P0 workspace session |

A platform capture is accepted only when it includes timestamp, app build identity, OS/WebView version, channel ID, ordered raw text frames, binary byte dumps and the exact reproduction steps. Static tests and package builds are not substitutes.

## Environment probe: 2026-09-01 Asia/Shanghai

- Android SDK and `adb` are installed, but `adb devices -l` returned no devices. The installed emulator tool reported no configured AVDs.
- DevEco Studio and its SDK are installed, but `hdc list targets` returned `[Empty]`. No configured local HarmonyOS emulator was discovered.
- The host is Windows and has no `xcrun`; an iOS runtime capture cannot be produced on this machine.

P1 must not begin from this checkout until the three required captures are added, or the scope owner explicitly changes the P0 device-evidence gate. Captures should be stored under `captures/<platform>/<build-id>/` with a `metadata.json`, ordered `frames.jsonl`, and binary payload files whose SHA-256 values are referenced by the JSONL records.
