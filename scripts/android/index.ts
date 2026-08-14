import fs from "node:fs";
import yargs from "yargs";
import { getIpv4Address } from "../utils/network.ts";
import { build, dev } from "./commands/index.ts";
import {
  ADB_PATH,
  ANDROID_HOME,
  EMULATOR_PATH,
  GRADLE_PATH,
} from "./constants.ts";

if (!ANDROID_HOME) {
  console.error("[android] ANDROID_HOME is not set");
  process.exit(1);
}
if (!fs.existsSync(ANDROID_HOME)) {
  console.error(`[android] ANDROID_HOME does not exist: ${ANDROID_HOME}`);
  process.exit(1);
}

if (!fs.existsSync(ADB_PATH)) {
  console.error(
    `[android] adb not found: ${ADB_PATH}. Install Android SDK Platform-Tools`,
  );
  process.exit(1);
}
if (!fs.existsSync(GRADLE_PATH)) {
  console.error(`[android] Gradle Wrapper not found: ${GRADLE_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(EMULATOR_PATH)) {
  console.warn(`[android] Emulator not found: ${EMULATOR_PATH}`);
}

await yargs()
  .locale("en")
  .scriptName("android")
  .command<{
    debugPort: number;
    device?: string;
    host: string;
    port: number;
  }>({
    command: "dev",
    describe: "Start the mobile dev server, install and run the Debug APK",
    builder: {
      device: {
        describe: "Connected device name or local AVD name",
        type: "string",
      },
      host: {
        default: getIpv4Address(),
        describe: "Host name or LAN IP exposed by the mobile dev server",
        type: "string",
      },
      port: {
        default: 1421,
        describe: "Mobile dev server port",
        type: "number",
      },
      "debug-port": {
        default: 9222,
        describe: "Local WebView debug port",
        type: "number",
      },
    },
    handler: dev,
  })
  .command<{ cache: boolean; debug: boolean }>({
    command: "build",
    describe: "Build the Android APK and app bundle",
    builder: {
      cache: {
        default: false,
        describe: "Reuse Gradle build cache and up-to-date task outputs",
        type: "boolean",
      },
      debug: {
        default: false,
        describe: "Build in debug mode",
        type: "boolean",
      },
    },
    handler: build,
  })
  .demandCommand(1)
  .strict()
  .showHelpOnFail(false)
  .help()
  .parseAsync(process.argv.slice(2));
