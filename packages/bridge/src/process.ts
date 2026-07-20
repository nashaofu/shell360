import { getBridgeBackend } from "./backend";

export const relaunch = () => getBridgeBackend().process.relaunch();
