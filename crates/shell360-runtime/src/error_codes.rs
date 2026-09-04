//! Single source of truth for the wire-level error code strings that travel
//! through JSB. Both `shell360_runtime::RuntimeError` and
//! `shell360_ffi::FfiError` resolve their `code()` from these constants so a
//! typo or rename cannot drift between the two crates.
//!
//! Codes are stable protocol identifiers consumed by the TS bridge
//! (`bridge/src/data.ts`, `bridge/src/ssh.ts`) and by mobile hosts.

pub const BRIDGE_INVALID_REQUEST: &str = "BRIDGE_INVALID_REQUEST";
pub const KEYGEN_ERROR: &str = "KEYGEN_ERROR";
pub const JSB_INVALID_RESPONSE: &str = "JSB_INVALID_RESPONSE";
pub const BRIDGE_IO_ERROR: &str = "BRIDGE_IO_ERROR";
pub const BRIDGE_UNAVAILABLE: &str = "BRIDGE_UNAVAILABLE";
pub const BRIDGE_UNSUPPORTED: &str = "BRIDGE_UNSUPPORTED";
pub const JSB_NATIVE_ERROR: &str = "JSB_NATIVE_ERROR";