import exitHook from "exit-hook";
import fkill from "fkill";
import { startMobileDevServer } from "../../utils/mobileDevServer.ts";
import {
  BUNDLE_ID,
  DERIVED_DATA_PATH,
  DEV_SERVER_PORT,
  PROJECT_PATH,
  SCHEME,
  WORKSPACE_DIR,
} from "../constants.ts";
import { bootSimulator, resolveSimulator } from "../devices.ts";
import { readBuildSettings, simctl, xcodebuild } from "../xcode.ts";

export async function dev({ device }: { device?: string }): Promise<void> {
  const simulator = await resolveSimulator(device);
  await bootSimulator(simulator);
  const controller = new AbortController();
  const unsubscribeExitHook = exitHook(() => controller.abort());
  await using cleanup = new AsyncDisposableStack();
  cleanup.defer(unsubscribeExitHook);
  cleanup.defer(() => controller.abort());
  const { subprocess: server } = await startMobileDevServer({
    env: { ...process.env, ENV_PLATFORM: "iOS" },
    port: DEV_SERVER_PORT,
    workspaceDir: WORKSPACE_DIR,
    signal: controller.signal,
  });
  cleanup.defer(() => {
    if (server.pid) {
      return fkill(server.pid, { silent: true, force: true, tree: true });
    }
  });
  const buildArguments = [
    "-project",
    PROJECT_PATH,
    "-scheme",
    SCHEME,
    "-configuration",
    "Debug",
    "-sdk",
    "iphonesimulator",
    "-destination",
    `platform=iOS Simulator,id=${simulator.udid}`,
    "-derivedDataPath",
    DERIVED_DATA_PATH,
  ];
  await xcodebuild([...buildArguments, "build"]);
  const settings = await readBuildSettings(buildArguments);
  const targetBuildDirectory = settings.TARGET_BUILD_DIR;
  const productName = settings.FULL_PRODUCT_NAME;
  if (!targetBuildDirectory || !productName) {
    throw new Error("Xcode did not report the built app location");
  }
  await simctl([
    "install",
    simulator.udid,
    `${targetBuildDirectory}/${productName}`,
  ]);
  await simctl(["launch", simulator.udid, BUNDLE_ID]);
  await server;
}
