import { execa, type Options, type ResultPromise } from "execa";
import { WORKSPACE_DIR } from "./constants.ts";

export function xcodebuild(
  args: string[],
  options?: Partial<Options>,
): ResultPromise {
  return execa("xcodebuild", args, {
    cwd: WORKSPACE_DIR,
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
}

export function simctl(
  args: string[],
  options?: Partial<Options>,
): ResultPromise {
  return execa("xcrun", ["simctl", ...args], {
    cwd: WORKSPACE_DIR,
    encoding: "utf8",
    ...options,
  });
}
