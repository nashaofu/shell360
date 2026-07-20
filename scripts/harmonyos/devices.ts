import select from "@inquirer/select";
import {
  createMobileDeviceChoices,
  type MobileDeviceCandidate,
} from "../utils/mobileDevices.ts";
import { devecocli } from "./devecocli.ts";
import {
  getEmulators,
  type HarmonyOsEmulator,
  startEmulator,
} from "./emulator.ts";

export type ConnectedDevice = {
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

export async function getConnectedDevices(
  cancelSignal?: AbortSignal,
): Promise<ConnectedDevice[]> {
  const { stdout } = await devecocli(["device", "list", "--format", "json"], {
    cancelSignal,
  });
  try {
    const devices: unknown = JSON.parse(stdout);
    if (!Array.isArray(devices)) throw new Error("result is not an array");
    return devices.map((device, index) => {
      if (typeof device !== "object" || device === null) {
        throw new Error(`device #${index + 1} is not an object`);
      }
      const record = device as Record<string, unknown>;
      const { name, serial, deviceType } = record;
      if (typeof serial !== "string" || serial.length === 0) {
        throw new Error(`device #${index + 1} has invalid serial metadata`);
      }
      return {
        type: "connected",
        name: typeof name === "string" && name.length > 0 ? name : serial,
        serial,
        deviceType:
          typeof deviceType === "string" && deviceType.length > 0
            ? deviceType
            : "unknown",
      };
    });
  } catch (error) {
    throw new Error("Failed to parse DevEco connected device list", {
      cause: error,
    });
  }
}

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

export async function selectDevice(
  deviceName?: string,
  cancelSignal?: AbortSignal,
): Promise<string> {
  const [connectedDevices, emulators] = await Promise.all([
    getConnectedDevices(cancelSignal),
    getEmulators(cancelSignal),
  ]);
  const targets = connectedDevices.map((device) => device.serial);
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
      choices: createMobileDeviceChoices(
        devices.map(
          (device): MobileDeviceCandidate => ({
            id: device.type === "connected" ? device.serial : undefined,
            name: device.name,
            kind: device.type === "connected" ? "device" : "simulator",
            status: device.type === "connected" ? "running" : "stopped",
            deviceType: device.deviceType,
          }),
        ),
      ),
    },
    { signal: cancelSignal },
  );
  const device = devices[selected];

  return resolveDeviceSerial(device, new Set(targets), cancelSignal);
}
