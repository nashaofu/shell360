import { getBridgeBackend } from "./backend";

export const getVersion = () => getBridgeBackend().app.getVersion();
