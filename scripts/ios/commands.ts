import { execa, type ResultPromise } from "execa";
import exitHook from "exit-hook";
import fkill from "fkill";
import {
  ARCHIVE_PATH,
  BUILD_DIR,
  BUNDLE_ID,
  DEV_SERVER_PORT,
  PROJECT_PATH,
  SCHEME,
  WORKSPACE_DIR,
} from "./constants.ts";
import { bootSimulator, resolveSimulator } from "./devices.ts";
import { buildWebAssets, generateUniffi } from "./generation.ts";
import { simctl, xcodebuild } from "./xcode.ts";

async function waitForDevServer(signal: AbortSignal): Promise<void> {
  await execa(
    "pnpm",
    [
      "exec",
      "wait-on",
      `tcp:127.0.0.1:${DEV_SERVER_PORT}`,
      "--interval",
      "250",
      "--timeout",
      "120000",
    ],
    { cwd: WORKSPACE_DIR, cancelSignal: signal, stdio: "inherit" },
  );
}

async function startDevServer(signal: AbortSignal): Promise<ResultPromise> {
  const server = execa("pnpm", ["--filter", "mobile", "run", "dev"], {
    cwd: WORKSPACE_DIR,
    cancelSignal: signal,
    cleanup: true,
    stdio: "inherit",
  });
  try {
    await Promise.race([
      waitForDevServer(signal),
      server.then(() => {
        throw new Error("Mobile dev server exited before iOS was started");
      }),
    ]);
    return server;
  } catch (error) {
    if (server.pid)
      await fkill(server.pid, { silent: true, force: true, tree: true }).catch(
        () => undefined,
      );
    throw error;
  }
}

export async function devIOS({ device }: { device?: string }): Promise<void> {
  const simulator = await resolveSimulator(device);
  await bootSimulator(simulator);
  const controller = new AbortController();
  const unsubscribe = exitHook(() => controller.abort());
  const server = await startDevServer(controller.signal);
  try {
    await generateUniffi();
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
  } finally {
    unsubscribe();
    controller.abort();
    if (server.pid)
      await fkill(server.pid, { silent: true, force: true, tree: true }).catch(
        () => undefined,
      );
  }
}

export async function buildIOS({ cache }: { cache: boolean }): Promise<void> {
  await buildWebAssets();
  await generateUniffi();
  await xcodebuild(
    [
      "-project",
      PROJECT_PATH,
      "-scheme",
      SCHEME,
      "-configuration",
      "Release",
      "-sdk",
      "iphonesimulator",
      "-derivedDataPath",
      `${BUILD_DIR}/DerivedData`,
      ...(cache ? ["build"] : ["clean", "build"]),
    ],
    {
      env: {
        ...process.env,
        CODE_SIGNING_ALLOWED: "NO",
        CODE_SIGNING_REQUIRED: "NO",
      },
    },
  );
}

export async function archiveIOS(): Promise<void> {
  await buildWebAssets();
  await generateUniffi();
  await xcodebuild(
    [
      "-project",
      PROJECT_PATH,
      "-scheme",
      SCHEME,
      "-configuration",
      "Release",
      "-sdk",
      "iphoneos",
      "-archivePath",
      ARCHIVE_PATH,
      "archive",
    ],
    {
      env: {
        ...process.env,
        CODE_SIGNING_ALLOWED: process.env.CODE_SIGNING_ALLOWED ?? "NO",
        CODE_SIGNING_REQUIRED: process.env.CODE_SIGNING_REQUIRED ?? "NO",
      },
    },
  );
}
