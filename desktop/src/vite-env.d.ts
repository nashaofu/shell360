/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly TAURI_PLATFORM: 'windows' | 'darwin' | 'linux' | 'ios' | 'android';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  umami: {
    track: {
      (): Promise<void>;
      (data: Record<string, string>): Promise<void>;
      (event_name: string): Promise<void>;
      (event_name: string, data: Record<string, string>): Promise<void>;
    };
    identify: {
      (id: string): Promise<void>;
      (id: string, data: Record<string, string>): Promise<void>;
      (data: Record<string, string>): Promise<void>;
    };
  };
}
