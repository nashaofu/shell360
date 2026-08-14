import fs from "node:fs";
import yargs from "yargs";
import { getIpv4Address } from "../utils/network.ts";
import { build, type DevOptions, dev } from "./commands/index.ts";
import { DEVECO_HOME, DEVECO_SDK_HOME, HDC, HVIGORW } from "./constants.ts";

if (!DEVECO_HOME) {
  throw new Error(
    "DEVECO_HOME environment variable is not set; please set it to the root of your DevEco Studio installation",
  );
}
if (!DEVECO_SDK_HOME) {
  throw new Error(
    "DEVECO_SDK_HOME environment variable is not set; please set it to the root of your HarmonyOS SDK installation",
  );
}
if (!fs.existsSync(HVIGORW)) {
  throw new Error(
    `hvigorw executable not found at ${HVIGORW}; please ensure that DevEco Studio is installed correctly`,
  );
}
if (!fs.existsSync(HDC)) {
  throw new Error(
    `hdc executable not found at ${HDC}; please ensure that the HarmonyOS SDK is installed correctly`,
  );
}

await yargs()
  .locale("en")
  .scriptName("harmonyos")
  .command<DevOptions>({
    command: "dev",
    describe:
      "Build a debug HAP, install it with HDC, and launch the entry ability",
    builder: {
      device: {
        describe: "Connected device name, HDC serial, or emulator name",
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
  .command("build", "Build release web and native inputs", {}, build)
  .demandCommand(1)
  .strict()
  .showHelpOnFail(false)
  .help()
  .parseAsync(process.argv.slice(2));
