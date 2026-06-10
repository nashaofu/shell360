# shell360

A cross-platform SSH and SFTP client built with Tauri, React, and TypeScript. Supports Windows, macOS, Linux, Android, and iOS.

## Project Structure

```
shell360/
├── desktop/              # Tauri desktop app (React + Rsbuild)
├── mobile/               # Mobile app (React + Rsbuild)
├── shared/               # Shared components, hooks, atoms, utils (rslib → ESM)
├── src-tauri/            # Tauri Rust backend (lib.rs, command.rs, error.rs)
├── tauri-plugin-ssh/     # SSH plugin (Rust src/ + TS ts/)
├── tauri-plugin-data/    # Encrypted storage + database plugin
├── tauri-plugin-mobile/  # Mobile-specific plugin
└── resources/            # Static assets
```

This is a **pnpm workspace** monorepo. Packages: `desktop`, `mobile`, `shared`, `tauri-plugin-ssh`, `tauri-plugin-data`, `tauri-plugin-mobile`. `pnpm` is enforced (`preinstall` runs `only-allow pnpm`).

## Commands

```bash
# Install (builds shared via its postinstall)
pnpm install

# Type check all packages (uses TS project references / tsc -b)
pnpm run tsc

# Type check a single package
pnpm --filter desktop run tsc

# Lint / format (Biome)
pnpm run check          # biome check .
pnpm run check:fix      # biome check . --write

# Dev server (no root dev script — run per package)
pnpm --filter desktop run dev   # rsbuild dev
pnpm --filter shared run dev     # rslib build --watch
pnpm tauri dev                   # full Tauri desktop with hot reload

# Build (all packages)
pnpm run build

# Tauri build
pnpm tauri build
```

## Agent Workflow

- After making changes, determine which parts of the codebase were modified:
  - **Frontend (TypeScript/React/CSS)**: run `pnpm run tsc` and `pnpm run check:fix`. Resolve all newly introduced TypeScript and Biome issues.
  - **Rust code** (any `*.rs` under `src-tauri/`, `tauri-plugin-ssh/`, `tauri-plugin-data/`, `tauri-plugin-mobile/`): run `cargo fmt` and `cargo clippy --all-targets -- -D warnings` in the affected crate's directory. Resolve all formatting and clippy issues.
- If both frontend and Rust code were modified, run all four checks.
- At the end of each task, check whether related AI guidance or project documentation should be updated, including this `AGENTS.md`.
- Keep AI-facing guidance in this file only; do not create or maintain duplicate Copilot-specific instruction files.

## Tech Stack

- **Runtime**: Tauri v2
- **Frontend**: React 19, React Router 7, Rsbuild
- **UI**: Radix Themes v3, CSS Modules (Less)
- **State**: Jotai atoms
- **Forms**: react-hook-form
- **Terminal**: xterm.js (`@xterm/*`)
- **Desktop panels**: dockview-react
- **Backend**: Rust, Sea ORM + SQLite, `ssh-key` crate
- **Linting**: Biome 2 (a11y rules disabled)
- **TypeScript**: 6.x, strict mode, `noUnusedLocals`, `noUnusedParameters`, project references

## Frontend ↔ Backend Communication

- Frontend calls Rust via Tauri `invoke`.
- Backend exposes async functions marked `#[tauri::command]`.
- Plugin TS wrappers (in each plugin's `ts/` folder) wrap `invoke` from `@tauri-apps/api/core` using namespaced command IDs like `plugin:ssh|shell_open`, `plugin:ssh|sftp_read_dir`. App code calls these wrappers, **not** `invoke` directly.
- Long-lived connections (SSH shell, SFTP streams) use `Channel` for streaming.

## Conventions

### Code Style

- Double quotes, space indentation (Biome formatter)
- No comments unless explaining non-obvious logic
- TypeScript strict mode, no `any` — prefer type inference
- Imports auto-organized by Biome (`organizeImports: on`)

### Components

- Shared components go in `shared/src/components/`
- Desktop-specific components go in `desktop/src/components/`
- Folder-per-component: `index.tsx` + colocated `index.module.less`
- Use Radix Themes components where possible

### State Management

- Global state via Jotai atoms; file-per-domain named `*.atom.ts`
  - Shared: `shared/src/atoms/` (e.g. `session.atom.ts`, `portForwardings.atom.ts`, `appearance.atom.ts`)
  - Desktop: `desktop/src/atoms/` (e.g. `auth.atom.ts`, `crypto.atom.ts`, `modals.atom.ts`)
- Pattern: `atom(...)` plus exported custom hooks, often combined with ahooks (`useMemoizedFn`, `useLatest`)
- Local state via React hooks; form state via react-hook-form

### Styling

- Use CSS custom properties (Radix Theme tokens)
- No hardcoded colors — use theme tokens
- Responsive breakpoints: 480px, 720px, 1024px
- `focus-visible` states for accessibility

### Icons

- All icons live in `shared/src/components/Icon/svgs/`
- Re-exported from `shared/src/components/Icon/index.ts` as `<Name>Icon` (svgr `ReactComponent`)
- SVG attrs required: `width="1em" height="1em" fill="currentColor" viewBox="..." xmlns="http://www.w3.org/2000/svg"`
- No duplicate attributes

### Shared Package Rules

- `shared/` compiles to ESM and is imported by `desktop`/`mobile`
- Do **not** import Tauri APIs in `shared/` (breaks the build) — keep Tauri logic in `desktop/src/` or `mobile/src/`

### Rust

- Use the crate's result alias (e.g. `Shell360Result<T>`) instead of bare `Result` for unified error handling
- Async command functions use `#[tauri::command]`
- Plugin managers hold state as `Mutex<HashMap<Id, Data>>` (see `SSHManager`)
- Cross-platform splits via `#[cfg(desktop)]` / `#[cfg(mobile)]`

## Type Checking

```bash
pnpm run tsc                      # all packages
pnpm --filter desktop run tsc     # single package
```

All type errors must be resolved before committing. The workspace uses TS project references (`tsc -b`); `shared` is `composite` and emits declarations consumed by `desktop`/`mobile`.
