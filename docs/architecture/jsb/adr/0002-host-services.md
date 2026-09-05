# ADR-0002: HostServices primitive boundary

Status: Accepted.

## Decision

`HostServices` exposes system primitives, not JSB methods. `PlatformHostServices` implementations receive validated primitive parameters and complete calls with the Rust-defined `{code,message,details}` error model.

| Primitive | Android | iOS | HarmonyOS |
| --- | --- | --- | --- |
| `pickDocuments` / `saveDocument` | SAF | UIDocumentPicker | DocumentViewPicker |
| `readClipboard` / `writeClipboard` | ClipboardManager | UIPasteboard | pasteboard plus permission flow |
| `openExternal` | Intent | UIApplication | system action/router |
| `setSystemBarsAppearance` | WindowInsets/controller | UIKit appearance hook | window system-bar API |
| `closeWindow` | Activity finish | scene/window hook | Ability termination |
| `readScopedFile` / `writeScopedFile` | `content://` grant | security-scoped URL | `file://` grant |
| biometric authentication | Android biometric API | LocalAuthentication | user authentication API |

Rust owns URL scheme validation, app-local path canonicalization, staging-directory lifecycle, `app.getVersion`, `bridge.health`, and machine UID generation/persistence. Each host may read its legacy machine UID once and supply it to migration, but may not choose a new format or storage policy.

`PortSink` is separate from `HostServices`: create/transfer a port, write text or bytes to a named port, and close it. Neither interface may contain `ssh.*`, `data.*`, or other business method branches.

## Security

The existing origin restriction, external scheme allowlist, scoped-file grants, canonical path containment, and Android WebView capability diagnostics remain mandatory. Moving validation to Rust changes ownership, not policy strength.
