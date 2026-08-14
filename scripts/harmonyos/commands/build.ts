import { hvigorw } from "../hvigor.ts";

export async function build(): Promise<void> {
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
