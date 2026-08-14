import select from "@inquirer/select";
import {
  getEmulators,
  type HarmonyOsEmulator,
  startEmulator,
} from "./emulator.ts";
import { getHdcProperty, getHdcTargets } from "./hdc.ts";

type ConnectedDevice = {
  type: "connected";
  name: string;
  serial: string;
  deviceType: string;
};

type StoppedDevice = {
  type: "stopped";
  name: string;
  emulator: HarmonyOsEmulator;
  deviceType: string;
};

type HarmonyOsDevice = ConnectedDevice | StoppedDevice;

function resolveDevice(
  deviceName: string,
  devices: HarmonyOsDevice[],
): { device?: HarmonyOsDevice; reason?: string } {
  const matches = devices.filter(
    (device) =>
      device.name === deviceName ||
      (device.type === "connected" && device.serial === deviceName),
  );
  if (matches.length === 0) {
    return { reason: `HarmonyOS device or emulator not found: ${deviceName}` };
  }
  if (matches.length > 1) {
    return { reason: `HarmonyOS device name is ambiguous: ${deviceName}` };
  }
  return { device: matches[0] };
}

async function resolveDeviceSerial(
  device: HarmonyOsDevice,
  connectedTargets: Set<string>,
  cancelSignal?: AbortSignal,
): Promise<string> {
  return device.type === "connected"
    ? device.serial
    : startEmulator(device.emulator, connectedTargets, cancelSignal);
}

async function getConnectedDevices(
  targets: string[],
  emulators: HarmonyOsEmulator[],
  cancelSignal?: AbortSignal,
): Promise<ConnectedDevice[]> {
  return Promise.all(
    targets.map(async (serial) => {
      const [model, deviceType, softwareVersion] = await Promise.all([
        getHdcProperty(serial, "const.product.model", cancelSignal),
        getHdcProperty(serial, "const.product.devicetype", cancelSignal),
        getHdcProperty(serial, "const.product.software.version", cancelSignal),
      ]);
      const matchingEmulators = emulators.filter(
        (emulator) =>
          emulator.isRunning &&
          softwareVersion?.includes(emulator.softwareVersion),
      );
      const runningEmulator =
        matchingEmulators.length === 1 ? matchingEmulators[0] : undefined;

      return {
        type: "connected",
        name:
          runningEmulator?.name ??
          (model && model !== "emulator" ? model : serial),
        serial,
        deviceType: runningEmulator?.deviceType ?? deviceType ?? "unknown",
      };
    }),
  );
}

export async function selectDevice(
  deviceName?: string,
  cancelSignal?: AbortSignal,
): Promise<string> {
  const [targets, emulators] = await Promise.all([
    getHdcTargets(cancelSignal),
    getEmulators(cancelSignal),
  ]);

  const connectedDevices = await getConnectedDevices(
    targets,
    emulators,
    cancelSignal,
  );
  const devices: HarmonyOsDevice[] = [
    ...connectedDevices,
    ...emulators
      .filter((emulator) => !emulator.isRunning)
      .map(
        (emulator): StoppedDevice => ({
          type: "stopped",
          name: emulator.name,
          emulator,
          deviceType: emulator.deviceType,
        }),
      ),
  ];

  if (devices.length === 0) {
    throw new Error("No available HarmonyOS devices or emulators found");
  }

  if (deviceName !== undefined) {
    const resolution = resolveDevice(deviceName, devices);
    if (resolution.device) {
      return resolveDeviceSerial(
        resolution.device,
        new Set(targets),
        cancelSignal,
      );
    }
    console.warn(`[harmonyos] ${resolution.reason}. Select one from the list.`);
  }

  const selected = await select(
    {
      message: "Select a HarmonyOS device",
      choices: devices.map((device, index) => ({
        name: `${device.name} (${device.deviceType}, ${device.type})`,
        value: index,
      })),
    },
    { signal: cancelSignal },
  );
  const device = devices[selected];

  return resolveDeviceSerial(device, new Set(targets), cancelSignal);
}
