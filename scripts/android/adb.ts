import { setTimeout as delay } from "node:timers/promises";
import { execa, type Options, type ResultPromise } from "execa";
import { ADB_PATH, ANDROID_PACKAGE_NAME, WORKSPACE_DIR } from "./constants.ts";

export type Device = {
  serial?: string;
  deviceName: string;
  type: "connected" | "unavailable" | "stopped";
};

export function parseAdbDevices(output: string): Device[] {
  const lines = output.split(/\r?\n/).map((line) => line.trim());
  const headerIndex = lines.findIndex((line) =>
    line.startsWith("List of devices attached"),
  );

  if (headerIndex < 0) {
    throw new Error(`Unexpected adb devices output: ${output.trim()}`);
  }

  return lines.slice(headerIndex + 1).flatMap((line) => {
    if (!line || line.startsWith("*") || line.startsWith("adb server")) {
      return [];
    }

    const serialEnd = line.search(/\s/);
    if (serialEnd < 0) {
      return [];
    }

    const serial = line.slice(0, serialEnd);
    const details = line.slice(serialEnd).trim();
    const adbState = details.startsWith("no permissions")
      ? "no permissions"
      : details.match(/^\S+/)?.[0];

    if (!adbState) {
      return [];
    }

    const properties = Object.fromEntries(
      details
        .slice(adbState.length)
        .trim()
        .split(/\s+/)
        .flatMap((entry) => {
          const separator = entry.indexOf(":");
          return separator > 0
            ? [[entry.slice(0, separator), entry.slice(separator + 1)]]
            : [];
        }),
    );

    return [
      {
        serial,
        deviceName: properties.model?.replaceAll("_", " ") || serial,
        type: adbState === "device" ? "connected" : "unavailable",
      },
    ];
  });
}

export function adb(args: string[], options?: Partial<Options>): ResultPromise {
  return execa(ADB_PATH, args, {
    cwd: WORKSPACE_DIR,
    windowsHide: true,
    encoding: "utf8",
    ...options,
  });
}

export async function reverseTcpPort(
  serial: string,
  port: number,
  cancelSignal?: AbortSignal,
): Promise<void> {
  const address = `tcp:${port}`;
  const adbArgs = ["-s", serial];

  for (let attempt = 0; attempt < 60; attempt += 1) {
    cancelSignal?.throwIfAborted();

    await adb([...adbArgs, "reverse", address, address], {
      reject: false,
      cancelSignal,
    });

    const { stdout } = await adb([...adbArgs, "reverse", "--list"], {
      reject: false,
      cancelSignal,
    });
    const configured = stdout.split(/\r?\n/).some((line) => {
      const [, remote, local] = line.trim().split(/\s+/);
      return remote === address && local === address;
    });

    if (configured) {
      return;
    }

    await delay(500, undefined, { signal: cancelSignal });
  }

  throw new Error(`Failed to reverse ${address} on ${serial}`);
}

export async function monitorWebViewDebugPort(
  serial: string,
  port: number,
  cancelSignal: AbortSignal,
): Promise<void> {
  const adbArgs = ["-s", serial];
  const localAddress = `tcp:${port}`;
  let forwardedSocket: string | undefined;

  try {
    while (!cancelSignal.aborted) {
      const { stdout: pidOutput } = await adb(
        [...adbArgs, "shell", "pidof", ANDROID_PACKAGE_NAME],
        { reject: false, cancelSignal },
      );
      const pid = pidOutput.trim().split(/\s+/)[0];
      const remoteAddress = pid
        ? `localabstract:webview_devtools_remote_${pid}`
        : undefined;
      const { stdout: forwardOutput } = await adb(
        [...adbArgs, "forward", "--list"],
        { reject: false, cancelSignal },
      );
      let configuredRemoteAddress = forwardOutput
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .find(([, local]) => local === localAddress)?.[2];

      if (!remoteAddress) {
        if (configuredRemoteAddress) {
          await adb([...adbArgs, "forward", "--remove", localAddress], {
            reject: false,
            cancelSignal,
          });
        }
        forwardedSocket = undefined;
        await delay(1_000, undefined, { signal: cancelSignal });
        continue;
      }

      if (configuredRemoteAddress !== remoteAddress) {
        const { stdout: sockets } = await adb(
          [...adbArgs, "shell", "cat", "/proc/net/unix"],
          { reject: false, cancelSignal },
        );

        if (sockets.includes(`@webview_devtools_remote_${pid}`)) {
          await adb([...adbArgs, "forward", "--remove", localAddress], {
            reject: false,
            cancelSignal,
          });
          await adb([...adbArgs, "forward", localAddress, remoteAddress], {
            cancelSignal,
          });
          configuredRemoteAddress = remoteAddress;
        }
      }

      if (
        configuredRemoteAddress === remoteAddress &&
        forwardedSocket !== remoteAddress
      ) {
        forwardedSocket = remoteAddress;
        console.log(
          `[android] WebView debug URL: http://127.0.0.1:${port} (PID ${pid})`,
        );
      }

      await delay(1_000, undefined, { signal: cancelSignal });
    }
  } catch (error) {
    if (!cancelSignal.aborted) throw error;
  }
}
