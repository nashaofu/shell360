import * as timers from "node:timers/promises";
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

export async function monitorWebViewDebugPort(
  serial: string,
  port: number,
  cancelSignal: AbortSignal,
): Promise<void> {
  const localAddress = `tcp:${port}`;
  let forwardedSocket: string | undefined;

  try {
    while (!cancelSignal.aborted) {
      const { stdout: sockets } = await hdc(
        ["-t", serial, "shell", "cat", "/proc/net/unix"],
        { reject: false, cancelSignal },
      );
      const match = sockets.match(/@webview_devtools_remote_(\d+)/);
      const remoteAddress = match?.[1]
        ? `localabstract:webview_devtools_remote_${match[1]}`
        : undefined;
      const { stdout: forwardOutput } = await hdc(
        ["-t", serial, "fport", "ls"],
        { reject: false, cancelSignal },
      );
      const configuredRemoteAddress = forwardOutput
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .find(([, local]) => local === localAddress)?.[2];

      if (configuredRemoteAddress !== remoteAddress) {
        if (configuredRemoteAddress) {
          await hdc(
            [
              "-t",
              serial,
              "fport",
              "rm",
              localAddress,
              configuredRemoteAddress,
            ],
            { reject: false, cancelSignal },
          );
        }
        if (remoteAddress) {
          await hdc(["-t", serial, "fport", localAddress, remoteAddress], {
            cancelSignal,
          });
        }
      }

      if (remoteAddress && forwardedSocket !== remoteAddress) {
        forwardedSocket = remoteAddress;
        console.log(
          `[harmonyos] WebView DevTools: http://127.0.0.1:${port} (${remoteAddress})`,
        );
      }
      if (!remoteAddress) {
        forwardedSocket = undefined;
      }
      await timers.setTimeout(1_000, undefined, { signal: cancelSignal });
    }
  } catch (error) {
    if (!cancelSignal.aborted) throw error;
  }
}
