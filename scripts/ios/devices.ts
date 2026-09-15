import select from "@inquirer/select";
import {
  createMobileDeviceChoices,
  type MobileDeviceCandidate,
} from "../utils/mobileDevices.ts";
import { simctl } from "./xcode.ts";

type Simulator = {
  name: string;
  udid: string;
  state: string;
  runtime: string;
};

async function listSimulators(): Promise<Simulator[]> {
  const { stdout } = await simctl(["list", "devices", "available", "-j"]);
  const data = JSON.parse(stdout) as {
    devices: Record<
      string,
      Array<{
        name: string;
        udid: string;
        state: string;
        isAvailable?: boolean;
      }>
    >;
  };
  return Object.entries(data.devices)
    .flatMap(([runtime, devices]) =>
      devices
        .filter((device) => device.isAvailable !== false)
        .map((device) => ({ ...device, runtime })),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function resolveSimulator(requested?: string): Promise<Simulator> {
  const devices = await listSimulators();
  const matches = requested
    ? devices.filter(
        (device) => device.name === requested || device.udid === requested,
      )
    : [];
  if (requested && matches.length === 1) return matches[0];
  if (requested && matches.length > 1)
    throw new Error(`iOS simulator is ambiguous: ${requested}`);
  if (requested)
    console.warn(
      `[ios] Simulator not found: ${requested}. Select one from the list.`,
    );
  if (devices.length === 0)
    throw new Error("No available iOS simulators found");
  const index = await select({
    message: "Select an iOS simulator",
    choices: createMobileDeviceChoices(
      devices.map(
        (device): MobileDeviceCandidate => ({
          id: device.udid,
          name: device.name,
          kind: "simulator",
          status: device.state === "Booted" ? "running" : "stopped",
          deviceType: device.runtime.replace(
            "com.apple.CoreSimulator.SimRuntime.",
            "",
          ),
        }),
      ),
    ),
  });
  return devices[index];
}

export async function bootSimulator(device: Simulator): Promise<void> {
  if (device.state !== "Booted") {
    await simctl(["boot", device.udid], { reject: false });
    await simctl(["bootstatus", device.udid, "-b"]);
  }
}
