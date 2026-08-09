import fs from "node:fs";
import timers from "node:timers/promises";
import { execa, type Options, type ResultPromise } from "execa";
import fkill from "fkill";
import { adb, parseAdbDevices } from "./adb.ts";
import { EMULATOR_PATH, IS_WINDOWS, WORKSPACE_DIR } from "./constants.ts";

const EMULATOR_BOOT_ATTEMPTS = 180;
const EMULATOR_POLL_INTERVAL = 1_000;

function emulator(args: string[], options?: Partial<Options>): ResultPromise {
  return execa(EMULATOR_PATH, args, {
    cwd: WORKSPACE_DIR,
    windowsHide: true,
    encoding: "utf8",
    ...options,
  });
}

export async function getAvdNames(
  cancelSignal?: AbortSignal,
): Promise<string[]> {
  if (!fs.existsSync(EMULATOR_PATH)) {
    return [];
  }

  const { stdout } = await emulator(["-list-avds"], { cancelSignal });
  const avdNames = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  console.log(`[android] Found AVDs: ${avdNames.join(", ") || "none"}`);
  return avdNames;
}

export async function getRunningAvdName(
  serial: string,
  cancelSignal?: AbortSignal,
): Promise<string | undefined> {
  const { stdout } = await adb(["-s", serial, "emu", "avd", "name"], {
    reject: false,
    cancelSignal,
  });

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && line !== "OK");
}

async function waitForEmulator(
  avdName: string,
  childProcess: { exitCode: number | null; pid?: number },
  cancelSignal?: AbortSignal,
): Promise<string> {
  for (let attempt = 0; attempt < EMULATOR_BOOT_ATTEMPTS; attempt += 1) {
    cancelSignal?.throwIfAborted();

    if (childProcess.exitCode !== null) {
      throw new Error(`Failed to start Android emulator: ${avdName}`);
    }

    const { stdout } = await adb(["devices"], {
      reject: false,
      cancelSignal,
    });
    const serials = parseAdbDevices(stdout).flatMap((device) =>
      device.type === "connected" && device.serial?.startsWith("emulator-")
        ? [device.serial]
        : [],
    );
    let serial: string | undefined;

    for (const candidateSerial of serials) {
      if (
        (await getRunningAvdName(candidateSerial, cancelSignal)) === avdName
      ) {
        serial = candidateSerial;
        break;
      }
    }

    if (!serial) {
      await timers.setTimeout(EMULATOR_POLL_INTERVAL, undefined, {
        signal: cancelSignal,
      });
      continue;
    }

    const { stdout: bootCompleted } = await adb(
      ["-s", serial, "shell", "getprop", "sys.boot_completed"],
      { reject: false, cancelSignal },
    );

    if (bootCompleted.trim() === "1") {
      return serial;
    }

    await timers.setTimeout(EMULATOR_POLL_INTERVAL, undefined, {
      signal: cancelSignal,
    });
  }

  throw new Error(`Timed out waiting for Android emulator: ${avdName}`);
}

export async function startEmulator(
  avdName: string,
  cancelSignal?: AbortSignal,
): Promise<string> {
  console.log(`[android] Starting emulator: ${avdName}`);

  const emulatorProcess = emulator(["-avd", avdName], {
    cleanup: false,
    detached: !IS_WINDOWS,
    stdio: "ignore",
  });

  const childProcess = emulatorProcess.nodeChildProcess;
  const exitedBeforeBoot = emulatorProcess.then(() => {
    throw new Error(
      `Android emulator exited before boot completed: ${avdName}`,
    );
  });

  try {
    childProcess.unref();
    return await Promise.race([
      waitForEmulator(avdName, childProcess, cancelSignal),
      exitedBeforeBoot,
    ]);
  } catch (error) {
    if (childProcess.exitCode === null && childProcess.pid) {
      try {
        await fkill(childProcess.pid, {
          silent: true,
          force: true,
          tree: true,
        });
      } catch (cleanupError) {
        console.warn(
          `[android] Failed to stop emulator after startup failure: ${avdName}`,
          cleanupError,
        );
      }
    }
    throw error;
  }
}
