import { getBridgeBackend } from "./backend";

export const getMachineUid = () =>
  getBridgeBackend().machineUid.getMachineUid();
