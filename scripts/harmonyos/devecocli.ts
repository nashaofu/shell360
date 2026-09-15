import { execa, type Options, type ResultPromise } from "execa";
import {
  DEVECO_CLI_CLT_PATH,
  DEVECO_CLI_STUDIO_PATH,
  HARMONYOS_DIR,
} from "./constants.ts";

export function devecocli(
  args: string[],
  options?: Partial<Options>,
): ResultPromise {
  const { env, ...execaOptions } = options ?? {};
  return execa("pnpm", ["exec", "devecocli", ...args], {
    cwd: HARMONYOS_DIR,
    windowsHide: true,
    encoding: "utf8",
    ...execaOptions,
    env: {
      DEVECO_CLI_STUDIO_PATH,
      DEVECO_CLI_CLT_PATH,
      ...process.env,
      ...env,
    },
  });
}
