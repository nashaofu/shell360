import { getBridgeBackend } from "./backend";

export const getVersion = () => getBridgeBackend().app.getVersion();
export const setSystemBarsAppearance = (dark: boolean) =>
  getBridgeBackend().app.setSystemBarsAppearance(dark);
export const onBackPress = (callback: () => void) =>
  getBridgeBackend().app.onBackPress(callback);
export const backToBackground = () => getBridgeBackend().app.backToBackground();
