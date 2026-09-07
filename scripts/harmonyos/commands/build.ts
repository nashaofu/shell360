import path from "node:path";
import { moveArtifacts } from "../../utils/artifacts.ts";
import { HARMONYOS_BUILD_DIR, HARMONYOS_DIR } from "../constants.ts";
import { hvigorw } from "../hvigor.ts";
import { ohpm } from "../ohpm.ts";
import { prepareSigning } from "../signing.ts";

export type BuildOptions = {
  target: "app" | "hap";
};

export async function build({ target }: BuildOptions): Promise<void> {
  await using cleanup = new AsyncDisposableStack();
  await prepareSigning(cleanup);
  await ohpm(["install"], {
    stdio: "inherit",
  });

  const buildApp = target === "app";

  await hvigorw(
    [
      "--no-daemon",
      buildApp ? "assembleApp" : "assembleHap",
      "--mode",
      buildApp ? "project" : "module",
      "-p",
      "product=default",
      "-p",
      `buildMode=release`,
      "-p",
      "devServerHost=",
      "-p",
      "devServerPort=0",
    ],
    { stdio: "inherit" },
  );

  await moveArtifacts(
    path.join(
      HARMONYOS_DIR,
      "entry",
      "build",
      "default",
      "outputs",
      "default",
      "*.hap",
    ),
    HARMONYOS_BUILD_DIR,
  );

  if (buildApp) {
    await moveArtifacts(
      path.join(HARMONYOS_DIR, "build", "outputs", "default", "*.app"),
      HARMONYOS_BUILD_DIR,
    );
  }
}
