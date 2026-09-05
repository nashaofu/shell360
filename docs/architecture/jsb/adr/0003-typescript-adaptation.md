# ADR-0003: TypeScript adaptation boundary

Status: Accepted.

## Decision

`jsb/` may change protocol internals and consume generated method-name declarations. The native bootstrap remains `window.__JSB__.openChannel/closeChannel` unless a proven platform constraint requires an ADR amendment. `bridge/src/native.ts`, `runtime.ts`, `backend.ts`, and capability subpaths may change to install and consume the engine-backed native backend. `bridge/src/tauri.ts` and the desktop Tauri selection result do not change.

## Expected files and equivalence mapping

| Area/file | Allowed adaptation | Equivalence requirement |
| --- | --- | --- |
| `jsb/src/{types,protocol,jsb,jsb_channel,channel_registry}.ts` | generated method type and frozen envelope parsing | same open/close and invoke/event behavior |
| `bridge/src/native.ts` | replace stringly method typing and legacy adapter plumbing | each old `transport.invoke(method, params)` reaches the same capability and returns the same shape |
| `bridge/src/runtime.ts` | provider/backend installation wiring | native selects native; desktop selects Tauri exactly as before |
| `bridge/src/backend.ts` and capability subpaths | generated types/imports/capability truth | public capability semantics unchanged |
| `mobile/src/index.tsx` | backend provider/install call only, if signature changes | same startup order and rendered tree |
| `shared/src` hooks/atoms using `bridge/*` | import/type/call-signature adaptation only if compilation requires it | old bridge call maps one-to-one to new bridge call |
| `desktop/src/index.tsx` | no expected change; wiring-only change requires explicit review | Tauri backend selection and result unchanged |

Current repository search does not justify changes to component JSX, CSS/Less, route declarations, visible strings, or interaction ordering. Such a need is a stop-and-confirm item, not an implementation detail.

Business-layer adaptations must be a separate commit from engine/bridge logic. The PR description must list every changed business file as `old call -> new call`. Review gates reject JSX/DOM, stylesheet, routing, copy, feature, or interaction-flow diffs.

## Deferred confirmation list

- Whether generated declarations are a checked-in artifact or produced during the `jsb` build.
- Whether capability generation can cover native only without altering the Tauri capability path.
- Any business-file change beyond `mobile/src/index.tsx`; none is assumed until P4 compilation proves it necessary.
