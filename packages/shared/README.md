# `shared`

Cross-app code shared between `desktop/` and `mobile/`. Anything here runs
identically in both frontends; if a module is desktop-only or mobile-only,
it belongs in the corresponding package instead.

## Conventions

- **Byte-for-byte reuse today.** Only add code here when both `desktop/`
  and `mobile/` already consume it. Anticipated reuse is not enough;
  duplication is cheaper than a wrong abstraction.
- **No reverse dependencies.** `shared` must never import from
  `desktop/`, `mobile/`, or `bridge/`. If you find yourself wanting to,
  the right move is to put the abstraction in `bridge/` or keep the code
  in the calling package.
- **Re-export grouping.** `src/index.ts` groups exports by domain (atoms,
  business forms, framework primitives, terminal primitives, business
  hooks, runtime helpers). New modules should slot into the matching
  group with a short comment explaining which side it belongs to.
- **Pure primitives stay primitive.** `components/Icon`,
  `components/Loading`, `components/Message`, `components/Modal`, and the
  terminal primitives (`XTerminal`, `VirtualKeyboard`) carry no SSH/SFTP
  semantics. Don't bolt host/connection state onto them — wrap them in a
  business component instead.

## When NOT to add something here

- Desktop-only Tauri / dockview / window-management code → `desktop/`.
- Mobile-only native shell / WebView host code → `mobile/`.
- Anything that imports from `desktop/` or `mobile/`.
- Speculative cross-app abstractions used by a single side.

See [`AGENTS.md`](../../AGENTS.md) for the wider monorepo conventions.