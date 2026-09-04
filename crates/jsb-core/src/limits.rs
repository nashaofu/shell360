//! JSB frame size limits. Framework-level: zero business knowledge.

pub const DEFAULT_MAX_TEXT_FRAME_SIZE: usize = 1024 * 1024;
pub const DEFAULT_MAX_BINARY_FRAME_SIZE: usize = 10 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct JsbLimits {
  pub max_text_frame_size: usize,
  pub max_binary_frame_size: usize,
}

impl Default for JsbLimits {
  fn default() -> Self {
    Self {
      max_text_frame_size: DEFAULT_MAX_TEXT_FRAME_SIZE,
      max_binary_frame_size: DEFAULT_MAX_BINARY_FRAME_SIZE,
    }
  }
}