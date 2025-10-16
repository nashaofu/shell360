/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly TAURI_PLATFORM: 'windows' | 'darwin' | 'linux' | 'ios' | 'android';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
