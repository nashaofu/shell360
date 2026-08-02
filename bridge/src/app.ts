import { getBridgeBackend } from "./backend";

export const getVersion = () => getBridgeBackend().app.getVersion();
export const setSystemBarsAppearance = (dark: boolean) =>
  getBridgeBackend().app.setSystemBarsAppearance(dark);
