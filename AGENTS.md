# shell360

A cross-platform SSH and SFTP client built with Tauri, React, and TypeScript. Supports Windows, macOS, Linux, Android, and iOS.

## Project Structure

```
shell360/
├── android/              # Native Android WebView host (Compose + Gradle)
├── bridge/               # Backend-neutral frontend API + Tauri adapter
├── crates/               # Platform-neutral Rust libraries + UniFFI boundary
├── desktop/              # Tauri desktop app (React + Rsbuild)
├── mobile/               # Mobile app (React + Rsbuild)
├── shared/               # Shared components, hooks, atoms, utils (rslib → ESM)
├── src-tauri/            # Tauri Rust backend (lib.rs, command.rs, error.rs)
├── tauri-plugin-pty/     # Local PTY shell plugin (Rust src/ + TS ts/)
├── tauri-plugin-ssh/     # SSH plugin (Rust src/ + TS ts/)
├── tauri-plugin-data/    # Encrypted storage + database plugin
└── resources/            # Static assets
```

This is a **pnpm workspace** monorepo. Packages: `bridge`, `desktop`, `mobile`, `shared`, `tauri-plugin-ssh`, `tauri-plugin-data`, `tauri-plugin-pty`. `pnpm` is enforced (`preinstall` runs `only-allow pnpm`).

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

# Native Android (requires Android SDK/NDK and JAVA_HOME)
# Set ANDROID_HOME and NDK_HOME; adb does not need to be in PATH.
# Android Studio Run also works: `installDebug` automatically starts the mobile dev
# server in the background and sets up `adb reverse` (ensureDevServer/ensureAdbReverse).
# Stop the background dev server with `./gradlew stopDevServer`.
pnpm run android:dev      # select device, start dev server, install and launch
pnpm run android:build    # release APK
```

Android dev helpers live in `scripts/android/`: `constants.ts` resolves shared paths and environment variables; `adb.ts`, `devices.ts`, and `emulator.ts` handle device discovery and startup; `gradle.ts` runs the wrapper; `commands.ts` coordinates build and development lifecycles; and `index.ts` provides the CLI.

## Agent Workflow

- After making changes, determine which parts of the codebase were modified:
  - **Frontend (TypeScript/React/CSS)**: run `pnpm run tsc` and `pnpm run check:fix`. Resolve all newly introduced TypeScript and Biome issues.
  - **Rust code** (any `*.rs` under `crates/`, `src-tauri/`, `tauri-plugin-ssh/`, `tauri-plugin-data/`, `tauri-plugin-pty/`): run `cargo fmt` and `cargo clippy --all-targets -- -D warnings` in the affected crate's directory. Resolve all formatting and clippy issues.
  - **Native Android code**: run `pnpm run android:dev` or `pnpm run android:build`. The cross-platform Node.js runner selects `gradlew`/`gradlew.bat`; both `ANDROID_HOME` and `NDK_HOME` must point to existing SDK and NDK directories.
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

- Frontend business code imports backend APIs and models from capability subpaths. Tauri APIs mirror their package/module suffixes, such as `bridge/fs`, `bridge/dialog`, `bridge/window`, `bridge/store`, and `bridge/updater`. Project domains use `bridge/data`, `bridge/ssh`, and `bridge/pty`; custom Rust commands use `bridge/core`.
- `desktop/src/index.tsx` installs the Tauri backend. `mobile/src/index.tsx` selects `bridge/native` when hosted by the native Android WebView and otherwise installs `bridge/tauri`.
- Backend-neutral contracts and facade classes live in `bridge/src/`; Tauri-specific calls live only in `bridge/src/tauri.ts` and the low-level `tauri-plugin-*` packages.
- A different backend can implement `BridgeBackend` and be installed with `setBridgeBackend()` without changing `shared`, `desktop`, or `mobile` business code.
- Backend exposes async functions marked `#[tauri::command]`.
- Plugin TS wrappers (in each plugin's `ts/` folder) wrap `invoke` from `@tauri-apps/api/core` using namespaced command IDs like `plugin:ssh|shell_open`, `plugin:ssh|sftp_read_dir`. App code calls these wrappers, **not** `invoke` directly.
- Long-lived connections (SSH shell, SFTP streams) use `Channel` for streaming.
- The top-level `android/` project is the native Android host. Do not modify generated `src-tauri/gen/android` while the migration is in progress.

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
- Do **not** import Tauri APIs or `tauri-plugin-*` packages in `shared/`, `desktop/`, or `mobile/`; import from the matching `bridge/*` domain subpath instead.
- The `bridge` package has no root entry point. Every public API must be exposed through an explicit package export such as `bridge/fs` or `bridge/ssh`.
- Keep backend-specific implementations behind a backend-specific subpath such as `bridge/tauri`.
- Bridge capability types and facades are colocated in their public module; do not recreate aggregate `types.ts`, `runtime.ts`, or `index.ts` files.
- Alternative backends implement and register `BridgeBackend` through `bridge/backend`.
- `BridgeBackend` capability keys mirror public export suffixes (`fs`, `dialog`, `window`, etc.); do not introduce a catch-all platform object.

### Rust

- Use the crate's result alias (e.g. `Shell360Result<T>`) instead of bare `Result` for unified error handling
- Async command functions use `#[tauri::command]`
- Plugin managers hold state as `Mutex<HashMap<Id, Data>>` (see `SSHManager`)
- Cross-platform splits via `#[cfg(desktop)]` / `#[cfg(mobile)]`

## Commit Message Requirements

- Use Conventional Commits style: `<type>(<scope>): <subject>`.
- Preferred types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.
- Keep the subject concise, imperative, and preferably under 72 characters.
- Use a body only when extra context is helpful, and keep it focused on the why and impact of the change.
- For breaking changes, append `!` to the type/scope or add a `BREAKING CHANGE:` footer.

Examples:

- `feat(ssh): add support for inline command execution`
- `fix(pty): handle shell resize on Windows`
- `docs(readme): update installation instructions`

Avoid vague messages such as `update`, `fix bug`, or `misc changes`.

## Type Checking

```bash
pnpm run tsc                      # all packages
pnpm --filter desktop run tsc     # single package
```

All type errors must be resolved before committing. The workspace uses TS project references (`tsc -b`); `shared` is `composite` and emits declarations consumed by `desktop`/`mobile`.
