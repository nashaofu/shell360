import { execa, type Options, type ResultPromise } from "execa";
import {
  ANDROID_DIR,
  ANDROID_HOME,
  GRADLE_PATH,
  NDK_HOME,
} from "./constants.ts";

export function gradlew(
  args: string[],
  options?: Partial<Options>,
): ResultPromise {
  return execa(GRADLE_PATH, args, {
    cwd: ANDROID_DIR,
    env: {
      ...process.env,
      ANDROID_HOME,
      NDK_HOME,
    },
    windowsHide: true,
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
}
