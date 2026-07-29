import select from "@inquirer/select";
import { adb, type Device, parseAdbDevices } from "./adb.ts";
import { getAvdNames, getRunningAvdName, startEmulator } from "./emulator.ts";

async function getConnectedDevices(
  cancelSignal?: AbortSignal,
): Promise<Device[]> {
  const { stdout } = await adb(["devices", "-l"], { cancelSignal });
  const devices = parseAdbDevices(stdout);

  return Promise.all(
    devices.map(async (device) => {
      if (
        device.type !== "connected" ||
        !device.serial ||
        !device.serial.startsWith("emulator-")
      ) {
        return device;
      }

      const avdName = await getRunningAvdName(device.serial, cancelSignal);

      return {
        ...device,
        deviceName: avdName || device.deviceName,
      };
    }),
  );
}

function createDeviceList(devices: Device[], avdNames: string[]): Device[] {
  const runningAvdNames = new Set(
    devices
      .filter(
        (device) =>
          device.type === "connected" && device.serial?.startsWith("emulator-"),
      )
      .map((device) => device.deviceName),
  );
  const stoppedAvdNames = avdNames.filter(
    (avdName) => !runningAvdNames.has(avdName),
  );

  return [
    ...devices,
    ...stoppedAvdNames.map(
      (deviceName): Device => ({
        deviceName,
        type: "stopped",
      }),
    ),
  ];
}

function createDeviceChoices(
  devices: Device[],
): Array<{ name: string; value: number; disabled: boolean | string }> {
  // Add occurrence numbers only when multiple devices share the same name.
  const nameTotals = new Map<string, number>();
  const nameOccurrences = new Map<string, number>();

  for (const candidate of devices) {
    nameTotals.set(
      candidate.deviceName,
      (nameTotals.get(candidate.deviceName) || 0) + 1,
    );
  }

  return devices.map((candidate, index) => {
    const occurrence = (nameOccurrences.get(candidate.deviceName) || 0) + 1;
    nameOccurrences.set(candidate.deviceName, occurrence);
    const hasDuplicateName = (nameTotals.get(candidate.deviceName) ?? 0) > 1;
    const suffix = hasDuplicateName ? ` #${occurrence}` : "";
    return {
      name: `${candidate.deviceName}${suffix}`,
      value: index,
      disabled: candidate.type === "unavailable" ? "Device unavailable" : false,
    };
  });
}

async function getDeviceSerial(
  device: Device,
  cancelSignal?: AbortSignal,
): Promise<string> {
  if (device.type === "connected") {
    if (!device.serial) {
      throw new Error(
        `Connected Android device missing serial: ${device.deviceName}`,
      );
    }
    return device.serial;
  }
  if (device.type === "stopped") {
    return startEmulator(device.deviceName, cancelSignal);
  }

  throw new Error(`Android device is unavailable: ${device.deviceName}`);
}

function resolveDeviceByName(
  deviceName: string,
  devices: Device[],
): { device?: Device; reason?: string } {
  const matches = devices.filter((device) => device.deviceName === deviceName);

  if (matches.length === 0) {
    return { reason: `Android device or AVD not found: ${deviceName}` };
  }
  if (matches.length > 1) {
    return { reason: `Android device name is ambiguous: ${deviceName}` };
  }

  const [device] = matches;
  if (device.type === "unavailable") {
    return { reason: `Android device is unavailable: ${deviceName}` };
  }

  return { device };
}

export async function resolveDeviceSerial(
  deviceName?: string,
  cancelSignal?: AbortSignal,
): Promise<string> {
  const [devices, avdNames] = await Promise.all([
    getConnectedDevices(cancelSignal),
    getAvdNames(cancelSignal),
  ]);
  const deviceList = createDeviceList(devices, avdNames);
  let selectedDevice: Device | undefined;

  if (deviceName !== undefined) {
    const resolution = resolveDeviceByName(deviceName, deviceList);
    selectedDevice = resolution.device;
    if (resolution.reason) {
      console.warn(`[android] ${resolution.reason}. Select one from the list.`);
    }
  }

  if (!selectedDevice) {
    const selectableDevices = deviceList.filter(
      (device) => device.type !== "unavailable",
    );

    if (selectableDevices.length === 0) {
      throw new Error("No available Android devices or AVDs found");
    }

    const selectedDeviceIndex = await select(
      {
        message: "Select an Android device",
        choices: createDeviceChoices(deviceList),
      },
      { signal: cancelSignal },
    );
    selectedDevice = deviceList[selectedDeviceIndex];
  }

  return getDeviceSerial(selectedDevice, cancelSignal);
}
