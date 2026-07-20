import timers from "node:timers/promises";
import { WORKSPACE_DIR } from "./constants.ts";
import { devecocli } from "./devecocli.ts";
import { getConnectedDevices } from "./devices.ts";

const BOOT_ATTEMPTS = 180;
const BOOT_POLL_INTERVAL = 1_000;

export type HarmonyOsEmulator = {
  name: string;
  deviceType: string;
  isRunning: boolean;
};

type EmulatorOutput = Record<string, unknown>;

function readString(
  instance: EmulatorOutput,
  property: string,
  index: number,
): string {
  const value = instance[property];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `HarmonyOS emulator #${index + 1} has invalid ${property} metadata`,
    );
  }
  return value;
}

function parseEmulators(output: string): HarmonyOsEmulator[] {
  if (output.trim() === "[Empty]") return [];

  let instances: unknown;
  try {
    instances = JSON.parse(output);
  } catch (error) {
    throw new Error("Failed to parse HarmonyOS emulator list", {
      cause: error,
    });
  }
  if (!Array.isArray(instances)) {
    throw new Error("HarmonyOS emulator list is not an array");
  }

  return instances.map((instance: unknown, index) => {
    if (typeof instance !== "object" || instance === null) {
      throw new Error(`HarmonyOS emulator #${index + 1} is not an object`);
    }
    const metadata = instance as EmulatorOutput;
    const status = readString(metadata, "status", index);
    if (status !== "running" && status !== "stopped") {
      throw new Error(
        `HarmonyOS emulator #${index + 1} has invalid status metadata`,
      );
    }
    return {
      name: readString(metadata, "name", index),
      deviceType: readString(metadata, "deviceType", index),
      isRunning: status === "running",
    };
  });
}

export async function getEmulators(
  cancelSignal?: AbortSignal,
): Promise<HarmonyOsEmulator[]> {
  const { stdout } = await devecocli(["emulator", "list", "--format", "json"], {
    cancelSignal,
  });
  return parseEmulators(stdout);
}

export async function startEmulator(
  emulator: HarmonyOsEmulator,
  previousTargets: Set<string>,
  cancelSignal?: AbortSignal,
): Promise<string> {
  console.log(`[harmonyos] Starting emulator: ${emulator.name}`);
  const emulatorProcess = devecocli(["emulator", "start", emulator.name], {
    cwd: WORKSPACE_DIR,
    cleanup: false,
    detached: process.platform !== "win32",
    stdio: "ignore",
  });
  let startupError: unknown;
  void emulatorProcess.catch((error: unknown) => {
    startupError = error;
  });
  emulatorProcess.nodeChildProcess.unref();

  for (let attempt = 0; attempt < BOOT_ATTEMPTS; attempt += 1) {
    cancelSignal?.throwIfAborted();
    if (startupError) {
      throw new Error(`Failed to start HarmonyOS emulator: ${emulator.name}`, {
        cause: startupError,
      });
    }

    const devices = await getConnectedDevices(cancelSignal);
    for (const device of devices) {
      if (!previousTargets.has(device.serial)) return device.serial;
    }
    await timers.setTimeout(BOOT_POLL_INTERVAL, undefined, {
      signal: cancelSignal,
    });
  }

  throw new Error(`Timed out waiting for HarmonyOS emulator: ${emulator.name}`);
}
