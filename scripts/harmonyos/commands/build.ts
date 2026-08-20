import { hvigorw } from "../hvigor.ts";
import { ohpm } from "../ohpm.ts";

export async function build(): Promise<void> {
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
}
