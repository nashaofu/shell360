# shell360

A cross-platform SSH and SFTP client built with Tauri, React, and TypeScript.

## Project Structure

```
shell360/
├── desktop/          # Tauri desktop app (React + Rsbuild)
├── mobile/           # Mobile app
├── shared/           # Shared components, hooks, atoms, utils
├── src-tauri/        # Tauri Rust backend
├── tauri-plugin-ssh/     # SSH plugin
├── tauri-plugin-data/    # Data persistence plugin
├── tauri-plugin-mobile/  # Mobile plugin
└── resources/        # Static assets
```

## Commands

```bash
# Type check all packages
pnpm run tsc

# Type check desktop only
pnpm --filter desktop run tsc

# Lint / format
pnpm run check          # biome check
pnpm run check:fix      # biome check --write

# Run desktop dev server
pnpm --filter desktop run dev

# Build
pnpm run build
```

## Tech Stack

- **Runtime**: Tauri v2
- **Frontend**: React 19, React Router 7, Rsbuild
- **UI**: Radix Themes v3, CSS Modules (Less)
- **State**: Jotai atoms
- **Forms**: react-hook-form
- **Linting**: Biome (a11y rules disabled)
- **TypeScript**: strict mode, `noUnusedLocals`, `noUnusedParameters`

## Conventions

### Code Style
- Double quotes, space indentation (Biome)
- No comments unless explaining non-obvious logic
- TypeScript strict mode
- Import order organized by Biome

### Components
- Shared components go in `shared/src/components/`
- Desktop-specific components go in `desktop/src/components/`
- CSS Modules use `.module.less` extension
- Use Radix Themes components where possible
- Icons are SVG components in `shared/src/components/Icon/svgs/`

### State Management
- Global state via Jotai atoms in `shared/src/atoms/` and `desktop/src/atoms/`
- React hooks for local state
- Form state via react-hook-form

### Styling
- Use CSS custom properties (Radix Theme tokens)
- Responsive breakpoints: 480px, 720px, 1024px
- `focus-visible` states for accessibility
- No hardcoded colors - use theme tokens

### Icons
- All icons in `shared/src/components/Icon/svgs/`
- Must have: `width="1em" height="1em" fill="currentColor" viewBox="..." xmlns="http://www.w3.org/2000/svg"`
- No duplicate attributes
- Exported from `shared/src/components/Icon/index.ts`

## Type Checking

```bash
# Desktop type check
pnpm --filter desktop run tsc
```

All type errors must be resolved before committing. The workspace uses project references.
