import { execa, type Options, type ResultPromise } from "execa";
import { HARMONYOS_DIR, HDC } from "./constants.ts";

export function hdc(args: string[], options?: Partial<Options>): ResultPromise {
  return execa(HDC, args, {
    cwd: HARMONYOS_DIR,
    windowsHide: true,
    encoding: "utf8",
    ...options,
  });
}

export function parseHdcTargets(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^\[?empty\]?$/i.test(line) &&
        !/^list targets/i.test(line),
    );
}

export async function getHdcTargets(
  cancelSignal?: AbortSignal,
): Promise<string[]> {
  const { stdout } = await hdc(["list", "targets"], { cancelSignal });
  return parseHdcTargets(stdout);
}

export async function getHdcProperty(
  serial: string,
  property: string,
  cancelSignal?: AbortSignal,
): Promise<string | undefined> {
  const { stdout, exitCode } = await hdc(
    ["-t", serial, "shell", "param", "get", property],
    { reject: false, cancelSignal },
  );
  const value = stdout.trim();
  return exitCode === 0 && value && !/^get parameter .+ fail!/i.test(value)
    ? value
    : undefined;
}
