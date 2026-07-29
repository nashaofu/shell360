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

export async function forwardWebViewDebugPort(
  serial: string,
  port: number,
  cancelSignal: AbortSignal,
): Promise<void> {
  const adbArgs = ["-s", serial];
  const { stdout } = await adb(
    [...adbArgs, "shell", "pidof", ANDROID_PACKAGE_NAME],
    { cancelSignal },
  );
  const pid = stdout.trim().split(/\s+/)[0];

  if (!pid) {
    throw new Error("Unable to get the Android app process ID");
  }

  await adb(
    [
      ...adbArgs,
      "forward",
      `tcp:${port}`,
      `localabstract:webview_devtools_remote_${pid}`,
    ],
    { stdio: "inherit", cancelSignal },
  );
  console.log(`[android] WebView debug URL: http://127.0.0.1:${port}`);
}
