import { invoke } from '@tauri-apps/api/core';

export default function openUrl(url: string) {
  return invoke('open_url', { url });
}
