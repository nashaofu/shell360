# Current JSB frame protocol

Status: P0 static baseline. Device captures remain outstanding as listed in `README.md`.

## Ordered happy-path sequence

1. Page calls `window.__JSB__.openChannel(channelId)` with a UUID.
2. Host transfers one web port and posts a window control string:
   `{"source":"jsb.channel","type":"channel.opened","channelId":"..."}`.
3. Page writes an invoke string to the port:
   `{"type":"invoke.request","id":"...","method":"bridge.health","data":null}`.
4. Host writes a response string to the same port:
   `{"type":"invoke.response","id":"...","data":{"status":"ok"}}`.
5. Host may write an event string:
   `{"type":"emit","event":"data.authedChange","payload":true}`. Optional routing fields are `targetId`, `clientId`, and `sequence`.
6. A shell data channel carries raw `ArrayBuffer` bytes in both directions. iOS alone wraps bytes as Base64 in its version-1 WKScriptMessage envelope; the page-facing MessagePort still carries `ArrayBuffer`.
7. Page calls `window.__JSB__.closeChannel(channelId)`. Android and HarmonyOS close their native port; iOS sends `{version:1,kind:"channel.close",channelId,payload:""}` to the WK handler.

## Open failure

The window control string is
`{"source":"jsb.channel","type":"channel.open.failed","channelId":"...","error":{"code":"JSB_CHANNEL_OPEN_FAILED","message":"..."}}`.
Android can additionally report `JSB_CHANNEL_INVALID_ID`; HarmonyOS currently folds invalid IDs into `JSB_CHANNEL_OPEN_FAILED`; the iOS adapter silently returns for an empty ID.

## Invoke error envelope

All hosts intend to emit `{"type":"invoke.response","id":"...","error":{"code":"...","message":"...","details":...}}`. `details` is optional in host code; `jsb-core::reject` currently serializes absent details as `null`.

## iOS adapter comparison

The adapter and `jsb/` agree on `source`, `channelId`, `channel.opened`, `channel.open.failed`, and exactly one transferred port. Differences and risks:

- Android/Harmony validate UUID syntax before opening; iOS validates only non-empty string.
- iOS `openChannel` creates the page port itself and reports opened before native WK handling; the other hosts create/transfer native ports.
- iOS open failure is limited to the page-side `window.postMessage` operation; later native rejection has no equivalent open-failed path.
- iOS exposes private adapter helpers `receive` and `emit` in addition to the public open/close transport surface.
- iOS binary Base64 and version/kind envelope are adapter-only and have no schema-level interoperability test yet.
- The page parser accepts native messages with `source === null` and empty origin; the iOS adapter posts same-window/same-origin messages.
