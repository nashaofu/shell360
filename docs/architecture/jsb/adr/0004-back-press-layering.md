# ADR-0004: Route native back-press through the bridge capability layer

Status: Accepted.

## Context

The native back-press key was the only frontend feature that reached the
native host outside the JSB channel. Android, HarmonyOS, and iOS hosts ran
`window.dispatchEvent(new Event('shell360:back', { cancelable: true }))`
directly against the page, and `mobile/src/app/layouts/AppLayout` subscribed
with `window.addEventListener("shell360:back", ...)`. This bypassed the
`bridge` facade and coupled business code to a private, untyped DOM event
protocol that was duplicated across three hosts and the frontend.

Every other native-to-frontend signal (for example `data.authedChange`) already
flowed through the JSB `emit` channel, so the back-press path created a second,
parallel communication mechanism.

## Decision

Back-press is now a first-class `bridge` capability, modeled as a one-way emit
event plus an explicit invoke action:

- Native hosts emit `{"type":"emit","event":"app.back","payload":{}}`
  through the existing JSB `emit` channel (`Jsb::emit`), exactly like other
  runtime events.
- The frontend consumes it through `bridge/app.onBackPress(callback)`, which
  the native backend implements via `transport.on("app.back", ...)`.
- When the frontend is at the root route, it explicitly requests the platform
  "move to background" behavior via `bridge/app.backToBackground()`, a new
  host primitive (`app.backToBackground` -> `backToBackground`) routed through
  the standard invoke path.

The previous synchronous, cancelable `dispatchEvent` semantics are replaced by
an asynchronous emit plus an explicit action. The `shell360:back` DOM event and
its per-host `BACK_REQUEST_SCRIPT` are removed.

## Changes

- `crates/shell360-runtime/src/methods.rs`: added `app.backToBackground` host
  primitive and method spec (method count 69 -> 70).
- Android: `JsbPortBridge.emitBackPress()` emits the event; `MainActivity`
  back-press callback delegates to it (falling back to `moveTaskToBack` only
  when the bridge is not yet ready); `PlatformHostServices` gained the
  `backToBackground` primitive.
- HarmonyOS: `MessagePortBridge.emitBackPress()` emits the event;
  `Index.onBackPress` delegates to it; `HarmonyHostServices` gained the
  `backToBackground` primitive (`moveAbilityToBackground`).
- iOS: `IosHostServices` gained a `backToBackground` no-op (iOS has no
  platform "move to background" primitive and no back key; navigation is
  frontend-owned).
- `bridge`: `BridgeBackend.app` gained `onBackPress` and `backToBackground`;
  `app.ts` exposes both; `native.ts` wires them to `transport.on` / `invoke`;
  `tauri.ts` provides no-op desktop implementations.
- `mobile/src/app/layouts/AppLayout/index.tsx`: subscribes via
  `onBackPress` and calls `backToBackground` at the root route; removed the
  `window.addEventListener("shell360:back", ...)` coupling.

## Consequences

- Business code depends only on `bridge`; the native event name is confined to
  each host bridge implementation, mirroring the existing `data.authedChange`
  pattern.
- The back-press signal is asynchronous, so the platform "move to background"
  decision moved from a synchronous host-side check to an explicit frontend
  invoke. This matches the JSB invoke/emit capability model.
- A back-press emitted before the control channel opens is silently dropped;
  hosts fall back to their platform default when the bridge is not ready.
