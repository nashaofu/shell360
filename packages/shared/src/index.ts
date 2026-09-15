//! # `shared` package
//!
//! Cross-app code shared between `desktop/` and `mobile/`. Every module here
//! runs in both frontends; if a module is desktop-only or mobile-only, it
//! belongs in the corresponding package instead.
//!
//! ## Module taxonomy
//!
//! The re-exports below are grouped so consumers can tell at a glance which
//! modules are framework primitives (UI building blocks that should never
//! leak business semantics) versus which are SSH/SFTP/host business
//! vocabulary that happens to be shared between the two frontends.
//!
//! - **atoms** — Jotai atoms backing cross-app state. All are SSH/SFTP
//!   business state: appearance, port forwardings, sessions, transfers.
//!   They live here because both frontends read and write the same shape,
//!   not because they are platform-neutral.
//! - **components** — Mix of framework UI primitives (Icon, Loading,
//!   Message, Modal, XTerminal, VirtualKeyboard) and SSH/SFTP business
//!   forms (EditHostForm, EditKeyForm, GenerateKeyForm,
//!   PortForwardingForm, TransferProgress, ...).
//! - **hooks** — Data-access hooks for the cross-app business domain
//!   (useHosts, useKeys, useShell, useTerminal, useSftp, ...). Generic
//!   data-fetching helpers (useSWR) live here only because every consumer
//!   is one of the business hooks above.
//! - **utils** — Business adapters (host/ssh/sftp/portForwarding/
//!   knownHosts/osc/display/terminal) and runtime helpers
//!   (env/sleep/style/umami).
//!
//! ## When to add something here
//!
//! Add to `shared` only when the code is byte-for-byte reused by both
//! `desktop/` and `mobile/` today. Future reuse alone is not a reason;
//! prefer the smallest possible home until the duplication actually
//! appears.
//!
//! ## When NOT to add something here
//!
//! - Desktop-only Tauri / dockview / window-management code.
//! - Mobile-only native shell / WebView host code.
//! - Anything that imports from `desktop/` or `mobile/` (a one-way
//!   dependency from `shared` would invert the layering).

// re-exports
export { v4 as uuidV4 } from "uuid";
// atoms — cross-app business state.
export * from "./atoms/appearance.atom";
export * from "./atoms/portForwardings.atom";
export * from "./atoms/session.atom";
export * from "./atoms/transfer.atom";
// components — SSH/SFTP business forms.
export * from "./components/EditHostForm";
export * from "./components/EditKeyForm";
export * from "./components/GenerateKeyForm";
export * from "./components/HostTagsSelect";
// components — framework UI primitives (no SSH/SFTP semantics).
export * from "./components/Icon";
export * from "./components/Loading";
export * from "./components/Message";
export * from "./components/Modal";
export * from "./components/PortForwardingForm";
export * from "./components/PortForwardingLoading";
export * from "./components/SSHLoading";
export * from "./components/TextFieldPassword";
export * from "./components/TransferProgress";
// components — terminal primitives (xterm.js adapters).
export * from "./components/VirtualKeyboard";
export * from "./components/XTerminal";
// hooks — cross-app business data access.
export * from "./hooks/useHosts";
export * from "./hooks/useImportAppData";
export * from "./hooks/useKeys";
export * from "./hooks/useKnownHostsStore";
export * from "./hooks/usePortForwardings";
export * from "./hooks/useSftp";
export * from "./hooks/useSftpConnection";
export * from "./hooks/useSftpFileEditor";
export * from "./hooks/useShell";

// hooks — generic utilities consumed by the business hooks above.
export * from "./hooks/useSWR";
export * from "./hooks/useTerminal";
// utils — business adapters.
export * from "./utils/display";
// utils — runtime helpers.
export * from "./utils/env";
export * from "./utils/form";
export * from "./utils/host";
export * from "./utils/knownHosts";
export * from "./utils/osc";
export * from "./utils/portForwarding";
export * from "./utils/sftp";
export * from "./utils/sleep";
export * from "./utils/ssh";
export * from "./utils/style";
export * from "./utils/terminal";
export * from "./utils/umami";
