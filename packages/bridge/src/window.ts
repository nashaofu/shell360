import { getBridgeBackend } from "./backend";

export type UnlistenFn = () => void;

export interface AppWindow {
  isMaximized(): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  onResized(callback: () => void): Promise<UnlistenFn>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
}

export const getCurrentWindow = () =>
  getBridgeBackend().window.getCurrentWindow();
