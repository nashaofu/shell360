import { existsSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import select from "@inquirer/select";
import { execa } from "execa";
import yargs from "yargs";

const workspaceDir = fileURLToPath(new URL("../", import.meta.url));
const androidDir = path.join(workspaceDir, "android");
const isWindows = process.platform === "win32";

function execute(command, args, androidEnvironment, options = {}) {
  return execa(command, args, {
    cwd: workspaceDir,
    env: androidEnvironment,
    windowsHide: true,
    ...options,
  });
}

function getAndroidEnvironment() {
  const sdkRoot = process.env.ANDROID_HOME;

  if (!sdkRoot) {
    throw new Error("Set the ANDROID_HOME environment variable");
  }

  if (!existsSync(sdkRoot)) {
    throw new Error(`Android SDK directory does not exist: ${sdkRoot}`);
  }

  return {
    ...process.env,
    ANDROID_HOME: sdkRoot,
  };
}

function getGradleWrapper() {
  const gradleWrapper = path.join(
    androidDir,
    isWindows ? "gradlew.bat" : "gradlew",
  );

  if (!existsSync(gradleWrapper)) {
    throw new Error(`Gradle Wrapper does not exist: ${gradleWrapper}`);
  }

  return gradleWrapper;
}

function getAdb(androidEnvironment) {
  const adb = path.join(
    androidEnvironment.ANDROID_HOME,
    "platform-tools",
    isWindows ? "adb.exe" : "adb",
  );

  if (!existsSync(adb)) {
    throw new Error(
      `adb does not exist: ${adb}. Install Android SDK Platform-Tools`,
    );
  }

  return adb;
}

function getEmulator(androidEnvironment) {
  const emulator = path.join(
    androidEnvironment.ANDROID_HOME,
    "emulator",
    isWindows ? "emulator.exe" : "emulator",
  );

  return existsSync(emulator) ? emulator : undefined;
}

function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().match(/^(\S+)\s+(\S+)(?:\s+(.*))?$/))
    .filter(Boolean)
    .map((match) => {
      const properties = Object.fromEntries(
        [...(match[3] || "").matchAll(/(\S+):(\S+)/g)].map((property) => [
          property[1],
          property[2],
        ]),
      );

      return {
        serial: match[1],
        state: match[2],
        deviceName: properties.model?.replaceAll("_", " ") || match[1],
      };
    });
}

async function resolveDeviceNames(adb, androidEnvironment, devices) {
  return Promise.all(
    devices.map(async (device) => {
      if (device.state !== "device" || !device.serial.startsWith("emulator-")) {
        return device;
      }

      const { stdout } = await execute(
        adb,
        ["-s", device.serial, "emu", "avd", "name"],
        androidEnvironment,
        {
          reject: false,
        },
      );
      const avdName = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && line !== "OK");

      return {
        ...device,
        deviceName: avdName || device.deviceName,
      };
    }),
  );
}

async function getConnectedDevices(adb, androidEnvironment) {
  const { stdout } = await execute(adb, ["devices", "-l"], androidEnvironment);

  return resolveDeviceNames(adb, androidEnvironment, parseDevices(stdout));
}

async function waitForPendingEmulators(adb, androidEnvironment, devices) {
  let currentDevices = devices;

  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (!hasPendingEmulators(currentDevices)) {
      return currentDevices;
    }

    await delay(1000);
    currentDevices = await getConnectedDevices(adb, androidEnvironment);
  }

  throw new Error("Timed out waiting for connected Android emulators");
}

function hasPendingEmulators(devices) {
  return devices.some(
    (device) =>
      device.serial.startsWith("emulator-") && device.state !== "device",
  );
}

async function getAvdNames(emulator, androidEnvironment) {
  if (!emulator) {
    return [];
  }

  const { stdout } = await execute(
    emulator,
    ["-list-avds"],
    androidEnvironment,
  );

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function waitForEmulator(
  adb,
  androidEnvironment,
  avdName,
  emulatorProcess,
) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (emulatorProcess.exitCode !== null) {
      throw new Error(`Failed to start Android emulator: ${avdName}`);
    }

    const devices = await getConnectedDevices(adb, androidEnvironment);
    const device = devices.find(
      (item) =>
        item.state === "device" &&
        item.serial.startsWith("emulator-") &&
        item.deviceName === avdName,
    );

    if (device) {
      const { stdout } = await execute(
        adb,
        ["-s", device.serial, "shell", "getprop", "sys.boot_completed"],
        androidEnvironment,
        {
          reject: false,
        },
      );

      if (stdout.trim() === "1") {
        return device.serial;
      }
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for Android emulator: ${avdName}`);
}

async function startEmulator(adb, emulator, androidEnvironment, avdName) {
  console.log(`[android] Starting emulator: ${avdName}`);
  const emulatorProcess = execute(
    emulator,
    ["-avd", avdName],
    androidEnvironment,
    {
      cleanup: false,
      detached: true,
      stdio: "ignore",
    },
  );
  emulatorProcess.catch(() => {});

  await new Promise((resolve, reject) => {
    emulatorProcess.once("spawn", resolve);
    emulatorProcess.once("error", reject);
  });
  emulatorProcess.unref();

  try {
    return await waitForEmulator(
      adb,
      androidEnvironment,
      avdName,
      emulatorProcess,
    );
  } catch (error) {
    if (emulatorProcess.exitCode === null) {
      emulatorProcess.kill("SIGTERM");
      await emulatorProcess.catch(() => {});
    }
    throw error;
  }
}

function getMatchingDevices(devices, deviceName) {
  return devices.filter(
    (device) => device.state === "device" && device.deviceName === deviceName,
  );
}

function createDeviceCandidates(devices, avdNames) {
  const runningAvdNames = new Set(
    devices
      .filter(
        (device) =>
          device.state === "device" && device.serial.startsWith("emulator-"),
      )
      .map((device) => device.deviceName),
  );
  const stoppedAvdNames = hasPendingEmulators(devices)
    ? []
    : avdNames.filter((avdName) => !runningAvdNames.has(avdName));

  return [
    ...devices.map((device) => ({
      deviceName: device.deviceName,
      serial: device.serial,
      state: device.state,
      type: device.state === "device" ? "connected" : "unavailable",
    })),
    ...stoppedAvdNames.map((deviceName) => ({
      deviceName,
      type: "stopped",
    })),
  ];
}

function createDeviceChoices(candidates) {
  const nameTotals = new Map();
  const nameOccurrences = new Map();

  for (const candidate of candidates) {
    nameTotals.set(
      candidate.deviceName,
      (nameTotals.get(candidate.deviceName) || 0) + 1,
    );
  }

  return candidates.map((candidate, index) => {
    const occurrence = (nameOccurrences.get(candidate.deviceName) || 0) + 1;
    nameOccurrences.set(candidate.deviceName, occurrence);
    const suffix =
      nameTotals.get(candidate.deviceName) > 1 ? ` #${occurrence}` : "";
    const status =
      candidate.type === "stopped" ? "stopped" : candidate.state || "connected";

    return {
      name: `${candidate.deviceName}${suffix} (${status})`,
      value: index,
      disabled:
        candidate.type === "unavailable" ? `State: ${candidate.state}` : false,
    };
  });
}

async function resolveRequestedDevice(
  adb,
  androidEnvironment,
  emulator,
  avdNames,
  devices,
  requestedName,
) {
  let currentDevices = devices;
  let matchedDevices = getMatchingDevices(currentDevices, requestedName);
  const requestedAvdExists = avdNames.includes(requestedName);

  if (matchedDevices.length === 1) {
    const [matchedDevice] = matchedDevices;
    if (!requestedAvdExists || matchedDevice.serial.startsWith("emulator-")) {
      return matchedDevice.serial;
    }
  }

  if (matchedDevices.length > 0) {
    throw new Error(
      `Device name is ambiguous. Select one from the interactive list: ${requestedName}`,
    );
  }

  if (!requestedAvdExists) {
    throw new Error(`Android device or AVD not found: ${requestedName}`);
  }

  if (hasPendingEmulators(currentDevices)) {
    currentDevices = await waitForPendingEmulators(
      adb,
      androidEnvironment,
      currentDevices,
    );
    matchedDevices = getMatchingDevices(currentDevices, requestedName);

    if (matchedDevices.length === 1) {
      const [matchedDevice] = matchedDevices;
      if (matchedDevice.serial.startsWith("emulator-")) {
        return matchedDevice.serial;
      }
    }
    if (matchedDevices.length > 0) {
      throw new Error(`Device name is ambiguous: ${requestedName}`);
    }
  }

  return startEmulator(adb, emulator, androidEnvironment, requestedName);
}

async function resolveDeviceSerial(adb, androidEnvironment, requestedName) {
  const emulator = getEmulator(androidEnvironment);
  let devices = await getConnectedDevices(adb, androidEnvironment);
  const avdNames = await getAvdNames(emulator, androidEnvironment);

  if (requestedName) {
    return resolveRequestedDevice(
      adb,
      androidEnvironment,
      emulator,
      avdNames,
      devices,
      requestedName,
    );
  }

  if (
    !devices.some((device) => device.state === "device") &&
    hasPendingEmulators(devices)
  ) {
    devices = await waitForPendingEmulators(adb, androidEnvironment, devices);
  }

  const candidates = createDeviceCandidates(devices, avdNames);
  const selectableCandidates = candidates.filter(
    (candidate) => candidate.type !== "unavailable",
  );

  if (selectableCandidates.length === 0) {
    throw new Error("No available Android devices or AVDs found");
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive device selection requires a terminal. Specify one with --device",
    );
  }

  const selectedCandidateIndex = await select({
    message: "Select an Android device",
    choices: createDeviceChoices(candidates),
  });
  const selectedCandidate = candidates[selectedCandidateIndex];

  if (selectedCandidate.type === "connected") {
    return selectedCandidate.serial;
  }

  return startEmulator(
    adb,
    emulator,
    androidEnvironment,
    selectedCandidate.deviceName,
  );
}

function run(command, args, androidEnvironment, options = {}) {
  return execute(command, args, androidEnvironment, {
    stdio: "inherit",
    ...options,
  });
}

async function forwardWebViewDebugPort(
  adb,
  adbArgs,
  androidEnvironment,
  port,
  cancelSignal,
) {
  const { stdout } = await execute(
    adb,
    [...adbArgs, "shell", "pidof", "com.nashaofu.shell360"],
    androidEnvironment,
    { cancelSignal },
  );
  const pid = stdout.trim().split(/\s+/)[0];

  if (!pid) {
    throw new Error("Unable to get the Android app process ID");
  }

  await run(
    adb,
    [
      ...adbArgs,
      "forward",
      `tcp:${port}`,
      `localabstract:webview_devtools_remote_${pid}`,
    ],
    androidEnvironment,
    { cancelSignal },
  );
  console.log(`[android] WebView debug URL: http://127.0.0.1:${port}`);
}

async function buildAndroid({ mode }) {
  const androidEnvironment = getAndroidEnvironment();
  const task = mode === "debug" ? "assembleDebug" : "assembleRelease";

  await run(getGradleWrapper(), ["-p", androidDir, task], androidEnvironment);
}

async function devAndroid({ debugPort, device }) {
  if (!Number.isInteger(debugPort) || debugPort < 1 || debugPort > 65535) {
    throw new Error("WebView debug port must be an integer from 1 to 65535");
  }

  let androidEnvironment = getAndroidEnvironment();
  const adb = getAdb(androidEnvironment);
  const selectedSerial = await resolveDeviceSerial(
    adb,
    androidEnvironment,
    device,
  );
  const adbArgs = ["-s", selectedSerial];
  const controller = new AbortController();
  const abort = () => controller.abort();
  let debugPortForwarded = false;
  let reversePortForwarded = false;
  let devServer;
  androidEnvironment = {
    ...androidEnvironment,
    ANDROID_SERIAL: selectedSerial,
  };

  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);

  try {
    await run(
      adb,
      [...adbArgs, "reverse", "tcp:1421", "tcp:1421"],
      androidEnvironment,
      { cancelSignal: controller.signal },
    );
    reversePortForwarded = true;
    devServer = execute(
      "pnpm",
      ["--filter", "mobile", "run", "dev"],
      androidEnvironment,
      {
        cancelSignal: controller.signal,
        cleanup: true,
        stdio: "inherit",
      },
    );
    devServer.catch(() => {});

    await run(
      getGradleWrapper(),
      ["-p", androidDir, "installDebug"],
      androidEnvironment,
      { cancelSignal: controller.signal },
    );
    await run(
      adb,
      [
        ...adbArgs,
        "shell",
        "am",
        "start",
        "-W",
        "-n",
        "com.nashaofu.shell360/.MainActivity",
      ],
      androidEnvironment,
      { cancelSignal: controller.signal },
    );
    await forwardWebViewDebugPort(
      adb,
      adbArgs,
      androidEnvironment,
      debugPort,
      controller.signal,
    );
    debugPortForwarded = true;
    await devServer;
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
    if (devServer) {
      devServer.kill("SIGTERM");
      await devServer.catch(() => {});
    }
    if (debugPortForwarded) {
      await execute(
        adb,
        [...adbArgs, "forward", "--remove", `tcp:${debugPort}`],
        androidEnvironment,
        {
          reject: false,
        },
      );
    }
    if (reversePortForwarded) {
      await execute(
        adb,
        [...adbArgs, "reverse", "--remove", "tcp:1421"],
        androidEnvironment,
        {
          reject: false,
        },
      );
    }
  }
}

try {
  await yargs(process.argv.slice(2))
    .locale("en")
    .scriptName("android")
    .command({
      command: "dev",
      describe: "Start the mobile dev server, install and run the Debug APK",
      builder: {
        "debug-port": {
          default: 9222,
          describe: "Local WebView debug port",
          type: "number",
        },
        device: {
          alias: "d",
          describe: "Connected device name or local AVD name",
          type: "string",
        },
      },
      handler: devAndroid,
    })
    .command({
      command: "build",
      describe: "Build the Android APK",
      builder: {
        mode: {
          choices: ["debug", "release"],
          default: "release",
          describe: "Build mode",
        },
      },
      handler: buildAndroid,
    })
    .demandCommand(1)
    .strict()
    .help()
    .exitProcess(false)
    .showHelpOnFail(false)
    .fail((message, error) => {
      throw error || new Error(message);
    })
    .parseAsync();
} catch (error) {
  console.error(`[android] ${error.message}`);
  process.exitCode = 1;
}
