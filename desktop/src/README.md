# Desktop UI Structure

The desktop UI follows a feature-oriented structure aligned with the mobile project:

- `app`: application bootstrap, guards, layouts, router configuration.
- `atoms`: global state (Jotai atoms) for cross-cutting concerns like auth, crypto, terminal, and updates.
- `components`: reusable UI components, complex widgets, and user action flows (SSH terminal, dialogs, page primitives, etc.).
- `hooks`: custom React hooks (modal, message, import/export).
- `routes`: page-level route screens (Hosts, Keys, Settings, etc.).
- `styles`: global styles and CSS custom properties.
- `utils`: utility functions (clipboard, open URL, config constants).
- `assets`: static assets (logo, icons).

Import rules:

- Prefer the `@/` alias for cross-slice imports.
- `utils`, `hooks`, `styles`, and `assets` must not import from other slices.
- `atoms` may import from `utils` and `hooks`, but not from `components`, `routes`, or `app`.
- `components` may import from `atoms`, `utils`, `hooks`, `styles`, and `assets`.
- `routes` may import from any layer.
- `app` may import from any layer.
- Route composition belongs in `app/routes`; route screens belong in `routes`.
