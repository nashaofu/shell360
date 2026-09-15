import exitHook from "exit-hook";
import fkill from "fkill";
import { startMobileDevServer } from "../../utils/mobileDevServer.ts";
import { WORKSPACE_DIR } from "../constants.ts";
import { devecocli } from "../devecocli.ts";
import { selectDevice } from "../devices.ts";
import { monitorWebViewDebugPort } from "../hdc.ts";
import { hvigorw } from "../hvigor.ts";
import { ohpm } from "../ohpm.ts";

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

  await ohpm(["install"], {
    stdio: "inherit",
    cancelSignal: controller.signal,
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
  await devecocli(
    ["run", "--skip-build", "--module", "entry", "--device", serial],
    {
      stdio: "inherit",
      cancelSignal: controller.signal,
    },
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
