import exitHook from "exit-hook";
import fkill from "fkill";
import { startMobileDevServer } from "../../utils/mobileDevServer.ts";
import {
  BUILD_DIR,
  BUNDLE_ID,
  DEV_SERVER_PORT,
  PROJECT_PATH,
  SCHEME,
  WORKSPACE_DIR,
} from "../constants.ts";
import { bootSimulator, resolveSimulator } from "../devices.ts";
import { simctl, xcodebuild } from "../xcode.ts";

export async function dev({ device }: { device?: string }): Promise<void> {
  const simulator = await resolveSimulator(device);
  await bootSimulator(simulator);
  const controller = new AbortController();
  const unsubscribeExitHook = exitHook(() => controller.abort());
  await using cleanup = new AsyncDisposableStack();
  cleanup.defer(unsubscribeExitHook);
  cleanup.defer(() => controller.abort());
  const { subprocess: server } = await startMobileDevServer({
    port: DEV_SERVER_PORT,
    workspaceDir: WORKSPACE_DIR,
    signal: controller.signal,
  });
  cleanup.defer(() => {
    if (server.pid) {
      return fkill(server.pid, { silent: true, force: true, tree: true });
    }
  });
  await xcodebuild([
    "-project",
    PROJECT_PATH,
    "-scheme",
    SCHEME,
    "-configuration",
    "Debug",
    "-sdk",
    "iphonesimulator",
    "-derivedDataPath",
    `${BUILD_DIR}/DerivedData`,
    "build",
  ]);
  await simctl([
    "install",
    simulator.udid,
    `${BUILD_DIR}/DerivedData/Build/Products/Debug-iphonesimulator/shell360.app`,
  ]);
  await simctl(["launch", simulator.udid, BUNDLE_ID]);
  await server;
}
