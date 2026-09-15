import { execa, type Options, type ResultPromise } from "execa";
import { WORKSPACE_DIR } from "./constants.ts";

type BuildSettings = Record<string, string>;

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

export async function readBuildSettings(
  args: string[],
): Promise<BuildSettings> {
  const { stdout } = await execa(
    "xcodebuild",
    [...args, "-showBuildSettings"],
    { cwd: WORKSPACE_DIR, encoding: "utf8" },
  );
  return Object.fromEntries(
    stdout
      .split("\n")
      .map((line) => line.match(/^\s*([^=]+?)\s*=\s*(.*)$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1], match[2]]),
  );
}
