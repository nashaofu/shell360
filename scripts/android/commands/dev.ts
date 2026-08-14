import exitHook from "exit-hook";
import fkill from "fkill";
import { startMobileDevServer } from "../../utils/mobileDevServer.ts";
import { adb, monitorWebViewDebugPort } from "../adb.ts";
import { ANDROID_PACKAGE_NAME, WORKSPACE_DIR } from "../constants.ts";
import { resolveDeviceSerial } from "../devices.ts";
import { gradlew } from "../gradle.ts";

export async function dev({
  device,
  host,
  port,
  debugPort,
}: {
  device?: string;
  host: string;
  port: number;
  debugPort: number;
}): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      "Mobile dev server port must be an integer from 1 to 65535",
    );
  }
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

  console.log(`[android] WebView URL: http://${host}:${port}`);
  const { subprocess: devServer } = await startMobileDevServer({
    env: { ...process.env, ENV_PLATFORM: "Android" },
    port,
    workspaceDir: WORKSPACE_DIR,
    signal: controller.signal,
  });
  cleanup.defer(() => {
    if (devServer.pid)
      return fkill(devServer.pid, { silent: true, force: true, tree: true });
  });
  await gradlew(
    ["installDebug", `-PdevServerHost=${host}`, `-PdevServerPort=${port}`],
    {
      cancelSignal: controller.signal,
    },
  );
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
  cleanup.defer(async () => {
    await adb([...adbArgs, "forward", "--remove", `tcp:${debugPort}`], {
      reject: false,
    });
  });
  const debugPortMonitor = monitorWebViewDebugPort(
    selectedSerial,
    debugPort,
    controller.signal,
  );
  cleanup.defer(async () => {
    controller.abort();
    await Promise.allSettled([debugPortMonitor]);
  });
  await Promise.race([devServer, debugPortMonitor]);
}
