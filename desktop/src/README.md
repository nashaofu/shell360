# Desktop UI Structure

The desktop UI follows a feature-oriented structure with clear ownership boundaries:

- `app`: application bootstrap, routing, layouts, guards, global model, global styles, and app-level configuration.
- `pages`: route-level screens. Pages compose features, widgets, and shared primitives.
- `features`: reusable user actions or flows, such as adding keys or changing crypto settings.
- `widgets`: larger UI blocks with internal state or subcomponents, such as the SSH terminal and update dialog.
- `shared`: framework-agnostic utilities, hooks, assets, styles, and small UI primitives.

Import rules:

- Prefer the `@/` alias for cross-slice imports.
- `shared` must not import from `app`, `pages`, `features`, or `widgets`.
- `features` and `widgets` may import from `shared`, but should not depend on pages.
- Route composition belongs in `app/routes`; route screens belong in `pages`.
- Global state that affects the whole desktop app belongs in `app/model`.
