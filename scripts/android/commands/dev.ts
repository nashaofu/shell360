import exitHook from "exit-hook";
import fkill from "fkill";
import { startMobileDevServer } from "../../utils/mobileDevServer.ts";
import { adb, monitorWebViewDebugPort, reverseTcpPort } from "../adb.ts";
import {
  ANDROID_PACKAGE_NAME,
  DEV_SERVER_PORT,
  WORKSPACE_DIR,
} from "../constants.ts";
import { resolveDeviceSerial } from "../devices.ts";
import { gradlew } from "../gradle.ts";

export async function dev({
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
  const { subprocess: devServer } = await startMobileDevServer({
    port: DEV_SERVER_PORT,
    workspaceDir: WORKSPACE_DIR,
    signal: controller.signal,
  });
  cleanup.defer(() => {
    if (devServer.pid)
      return fkill(devServer.pid, { silent: true, force: true, tree: true });
  });
  await reverseTcpPort(selectedSerial, DEV_SERVER_PORT, controller.signal);
  cleanup.defer(async () => {
    await adb([...adbArgs, "reverse", "--remove", `tcp:${DEV_SERVER_PORT}`], {
      reject: false,
    });
  });
  await gradlew(["installDebug"], { cancelSignal: controller.signal });
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
