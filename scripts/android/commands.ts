import { execa, type ResultPromise } from "execa";
import exitHook from "exit-hook";
import fkill from "fkill";
import { adb, forwardWebViewDebugPort, reverseTcpPort } from "./adb.ts";
import {
  ANDROID_PACKAGE_NAME,
  DEV_SERVER_PORT,
  WORKSPACE_DIR,
} from "./constants.ts";
import { resolveDeviceSerial } from "./devices.ts";
import { gradlew } from "./gradle.ts";

async function startMobileDevServer(
  signal: AbortSignal,
): Promise<{ subprocess: ResultPromise }> {
  signal.throwIfAborted();

  const subprocess = execa("pnpm", ["--filter", "mobile", "run", "dev"], {
    cwd: WORKSPACE_DIR,
    windowsHide: true,
    encoding: "utf8",
    cancelSignal: signal,
    cleanup: true,
    stdio: "inherit",
  });
  const exitedBeforeReady = subprocess.then(() => {
    throw new Error("Mobile dev server exited before Android was started");
  });
  const waitController = new AbortController();
  const waitProcess = execa(
    "pnpm",
    [
      "exec",
      "wait-on",
      `tcp:127.0.0.1:${DEV_SERVER_PORT}`,
      "--interval",
      "250",
      "--tcpTimeout",
      "500",
      "--timeout",
      "120000",
    ],
    {
      cwd: WORKSPACE_DIR,
      windowsHide: true,
      cancelSignal: AbortSignal.any([signal, waitController.signal]),
      cleanup: true,
      stdio: "inherit",
    },
  );

  try {
    await Promise.race([waitProcess, exitedBeforeReady]);

    // Resolve the race in favor of an exit observed at the readiness boundary.
    if (subprocess.nodeChildProcess.exitCode !== null) {
      await exitedBeforeReady;
    }

    return { subprocess };
  } catch (error) {
    if (subprocess.pid) {
      try {
        await fkill(subprocess.pid, { silent: true, force: true, tree: true });
      } catch (cleanupError) {
        console.warn(
          "[android] Failed to stop the mobile dev server after startup failure",
          cleanupError,
        );
      }
    }
    throw error;
  } finally {
    waitController.abort();
    await Promise.allSettled([waitProcess]);
  }
}

export async function buildAndroid({
  mode,
}: {
  mode: "debug" | "release";
}): Promise<void> {
  const task = mode === "debug" ? "assembleDebug" : "assembleRelease";

  await gradlew([task]);
}

export async function devAndroid({
  debugPort,
  device,
}: {
  debugPort: number;
  device?: string;
}): Promise<void> {
  if (!Number.isInteger(debugPort) || debugPort < 1 || debugPort > 65535) {
    throw new Error("WebView debug port must be an integer from 1 to 65535");
  }

  const controller = new AbortController();
  const unsubscribeExitHook = exitHook(() => controller.abort());
  await using cleanup = new AsyncDisposableStack();
  cleanup.defer(unsubscribeExitHook);
  cleanup.defer(() => controller.abort());

  const selectedSerial = await resolveDeviceSerial(device, controller.signal);
  const adbArgs = ["-s", selectedSerial];

  const { subprocess: devServer } = await startMobileDevServer(
    controller.signal,
  );
  const devServerPid = devServer.pid;
  if (devServerPid) {
    cleanup.defer(() =>
      fkill(devServerPid, {
        silent: true,
        force: true,
        tree: true,
      }),
    );
  }

  await reverseTcpPort(selectedSerial, DEV_SERVER_PORT, controller.signal);
  cleanup.defer(async () => {
    await adb([...adbArgs, "reverse", "--remove", `tcp:${DEV_SERVER_PORT}`], {
      reject: false,
    });
  });

  await gradlew(["installDebug"], {
    cancelSignal: controller.signal,
  });
  await adb(
    [
      ...adbArgs,
      "shell",
      "am",
      "start",
      "-W",
      "-n",
      `${ANDROID_PACKAGE_NAME}/.MainActivity`,
    ],
    { stdio: "inherit", cancelSignal: controller.signal },
  );
  await forwardWebViewDebugPort(selectedSerial, debugPort, controller.signal);
  cleanup.defer(async () => {
    await adb([...adbArgs, "forward", "--remove", `tcp:${debugPort}`], {
      reject: false,
    });
  });

  await devServer;
}
