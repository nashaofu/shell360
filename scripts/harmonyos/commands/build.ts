import path from "node:path";
import { moveArtifacts } from "../../utils/artifacts.ts";
import { HARMONYOS_BUILD_DIR, HARMONYOS_DIR } from "../constants.ts";
import { hvigorw } from "../hvigor.ts";
import { ohpm } from "../ohpm.ts";
import { prepareSigning } from "../signing.ts";

export async function build(): Promise<void> {
  await using cleanup = new AsyncDisposableStack();
  await prepareSigning(cleanup);
  await ohpm(["install"], {
    stdio: "inherit",
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
}
