import { getVersion } from "bridge/app";
import { getMachineUid } from "bridge/machine-uid";
import { v4 as uuidV4 } from "uuid";

function getDeviceUidFromLocalStorage() {
  let device_id = localStorage.getItem("device_id");

  if (!device_id) {
    device_id = uuidV4();
    localStorage.setItem("device_id", device_id);
  }

  return device_id;
}

export async function getDeviceUid(): Promise<string> {
  let device_id: string | undefined;

  device_id = await getMachineUid().catch(() => undefined);

  if (!device_id) {
    device_id = getDeviceUidFromLocalStorage();
  }

  return device_id;
}

export async function identify() {
  window.umami.identify(await getDeviceUid(), {
    version: await getVersion(),
  });
}
