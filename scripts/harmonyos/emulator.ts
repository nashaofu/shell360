import fs from "node:fs";
import timers from "node:timers/promises";
import { execa, type Options, type ResultPromise } from "execa";
import { EMULATOR, EMULATOR_INSTANCE_DIR, WORKSPACE_DIR } from "./constants.ts";
import { getHdcProperty, getHdcTargets } from "./hdc.ts";

const BOOT_ATTEMPTS = 180;
const BOOT_POLL_INTERVAL = 1_000;

export type HarmonyOsEmulator = {
  name: string;
  deviceType: string;
  isRunning: boolean;
  softwareVersion: string;
};

type EmulatorOutput = Record<string, unknown>;

function runEmulator(
  args: string[],
  options?: Partial<Options>,
): ResultPromise {
  return execa(EMULATOR, args, {
    cwd: WORKSPACE_DIR,
    windowsHide: true,
    encoding: "utf8",
    ...options,
  });
}

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
    const running = readString(metadata, "isRunning", index);
    if (running !== "true" && running !== "false") {
      throw new Error(
        `HarmonyOS emulator #${index + 1} has invalid isRunning metadata`,
      );
    }
    return {
      name: readString(metadata, "name", index),
      deviceType: readString(metadata, "deviceType", index),
      isRunning: running === "true",
      softwareVersion: readString(metadata, "os.softwareVersion", index),
    };
  });
}

export async function getEmulators(
  cancelSignal?: AbortSignal,
): Promise<HarmonyOsEmulator[]> {
  if (!fs.existsSync(EMULATOR) || !fs.existsSync(EMULATOR_INSTANCE_DIR)) {
    return [];
  }

  const { stdout } = await runEmulator(
    ["-instancePath", EMULATOR_INSTANCE_DIR, "-list", "-details"],
    { cancelSignal },
  );
  return parseEmulators(stdout);
}

export async function startEmulator(
  emulator: HarmonyOsEmulator,
  previousTargets: Set<string>,
  cancelSignal?: AbortSignal,
): Promise<string> {
  console.log(`[harmonyos] Starting emulator: ${emulator.name}`);
  const process = runEmulator(
    ["-start", emulator.name, "-instancePath", EMULATOR_INSTANCE_DIR],
    { cancelSignal, cleanup: false, stdio: "ignore" },
  );
  let startupError: unknown;
  void process.catch((error: unknown) => {
    startupError = error;
  });
  process.nodeChildProcess.unref();

  for (let attempt = 0; attempt < BOOT_ATTEMPTS; attempt += 1) {
    cancelSignal?.throwIfAborted();
    if (startupError) {
      throw new Error(`Failed to start HarmonyOS emulator: ${emulator.name}`, {
        cause: startupError,
      });
    }

    const targets = await getHdcTargets(cancelSignal);
    for (const serial of targets) {
      if (previousTargets.has(serial)) continue;
      const version = await getHdcProperty(
        serial,
        "const.product.software.version",
        cancelSignal,
      );
      if (version?.includes(emulator.softwareVersion)) return serial;
    }
    await timers.setTimeout(BOOT_POLL_INTERVAL, undefined, {
      signal: cancelSignal,
    });
  }

  throw new Error(`Timed out waiting for HarmonyOS emulator: ${emulator.name}`);
}
