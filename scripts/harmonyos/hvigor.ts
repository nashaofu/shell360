import { execa, type Options, type ResultPromise } from "execa";
import {
  DEVECO_SDK_HOME,
  HARMONYOS_DIR,
  HVIGORW,
  OHOS_PATH,
} from "./constants.ts";

export function hvigorw(
  args: string[],
  options?: Partial<Options>,
): ResultPromise {
  const { env, ...execaOptions } = options ?? {};
  return execa(HVIGORW, args, {
    cwd: HARMONYOS_DIR,
    windowsHide: true,
    encoding: "utf8",
    ...execaOptions,
    env: {
      ...process.env,
      ...env,
      DEVECO_SDK_HOME,
      PATH: OHOS_PATH,
    },
  });
}
