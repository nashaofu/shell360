import { v4 as uuidV4 } from 'uuid';
import {
  commands,
  MachineUidResponse,
  Result,
} from '@skipperndt/plugin-machine-uid';

function getDeviceUidFromLocalStorage() {
  let device_id = localStorage.getItem('device_id');

  if (!device_id) {
    device_id = uuidV4();
    localStorage.setItem('device_id', device_id);
  }

  return device_id;
}

export async function getDeviceUid(): Promise<string> {
  let device_id: string | undefined = undefined;

  const getMachineUidResult = await commands.getMachineUid().catch((error) => {
    return {
      status: 'error',
      error,
    } as Result<MachineUidResponse, Error>;
  });

  if (getMachineUidResult.status === 'ok') {
    device_id = getMachineUidResult.data.id || undefined;
  }

  if (!device_id) {
    device_id = getDeviceUidFromLocalStorage();
  }

  return device_id;
}

export async function identify() {
  window.umami.identify(await getDeviceUid());
}
