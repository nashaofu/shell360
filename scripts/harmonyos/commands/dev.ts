import path from "node:path";
import exitHook from "exit-hook";
import fkill from "fkill";
import { startMobileDevServer } from "../../utils/mobileDevServer.ts";
import {
  HARMONYOS_BUNDLE_NAME,
  HARMONYOS_DIR,
  WORKSPACE_DIR,
} from "../constants.ts";
import { selectDevice } from "../devices.ts";
import { hdc, monitorWebViewDebugPort } from "../hdc.ts";
import { hvigorw } from "../hvigor.ts";

export const HAP_PATH = path.join(
  HARMONYOS_DIR,
  "entry",
  "build",
  "default",
  "outputs",
  "default",
  "entry-default-unsigned.hap",
);

export type DevOptions = {
  device?: string;
  debugPort: number;
  host: string;
  port: number;
};

export async function dev({
  device,
  debugPort,
  host,
  port,
}: DevOptions): Promise<void> {
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

  const serial = await selectDevice(device, controller.signal);
  const devServerUrl = `http://${host}:${port}`;
  console.log(`[harmonyos] WebView URL: ${devServerUrl}`);

  const { subprocess: devServer } = await startMobileDevServer({
    env: { ...process.env, ENV_PLATFORM: "HarmonyOS" },
    port,
    workspaceDir: WORKSPACE_DIR,
    signal: controller.signal,
  });
  cleanup.defer(() => {
    if (devServer.pid) {
      return fkill(devServer.pid, { silent: true, force: true, tree: true });
    }
  });

  await hvigorw(
    [
      "--no-daemon",
      "assembleHap",
      "--mode",
      "module",
      "-p",
      "product=default",
      "-p",
      "buildMode=debug",
      "-p",
      `devServerHost=${host}`,
      "-p",
      `devServerPort=${port}`,
    ],
    { stdio: "inherit", cancelSignal: controller.signal },
  );
  await hdc(["-t", serial, "install", HAP_PATH], {
    stdio: "inherit",
    cancelSignal: controller.signal,
  });
  await hdc(
    [
      "-t",
      serial,
      "shell",
      "aa",
      "start",
      "-a",
      "EntryAbility",
      "-b",
      HARMONYOS_BUNDLE_NAME,
    ],
    { stdio: "inherit", cancelSignal: controller.signal },
  );
  const debugPortMonitor = monitorWebViewDebugPort(
    serial,
    debugPort,
    controller.signal,
  );
  cleanup.defer(async () => {
    controller.abort();
    await Promise.allSettled([debugPortMonitor]);
  });
  console.log(
    `[harmonyos] WebView DevTools: chrome://inspect/#devices; add localhost:${debugPort} in Configure...`,
  );
  await Promise.race([devServer, debugPortMonitor]);
}
