import { existsSync } from "node:fs";
import yargs from "yargs";
import { build, buildNative, dev, webAssets } from "./commands/index.ts";
import { IS_MACOS, PROJECT_PATH } from "./constants.ts";

if (!IS_MACOS) {
  console.error("[ios] iOS commands require macOS and Xcode");
  process.exit(1);
}
if (!existsSync(PROJECT_PATH)) {
  console.error(`[ios] Xcode project not found: ${PROJECT_PATH}`);
  process.exit(1);
}

await yargs()
  .locale("en")
  .scriptName("ios")
  .command<{ device?: string }>({
    command: "dev",
    describe: "Build, install and launch the iOS Debug app",
    builder: { device: { type: "string", describe: "Simulator name or UDID" } },
    handler: dev,
  })
  .command<{ archive: boolean; cache: boolean }>({
    command: "build",
    describe: "Build the iOS Release app for simulator",
    builder: {
      cache: {
        type: "boolean",
        default: false,
        describe: "Reuse Xcode build outputs (default: clean first)",
      },
      archive: {
        type: "boolean",
        default: false,
        describe: "Create a device archive instead of a simulator build",
      },
    },
    handler: build,
  })
  .command("web-assets", "Build and copy mobile web assets", {}, webAssets)
  .command<{ archs: string; configuration: string; platform: string }>({
    command: "build-native",
    describe: "Build Rust libraries and Swift bindings for an Xcode target",
    builder: {
      platform: {
        type: "string",
        choices: ["iphoneos", "iphonesimulator"],
        demandOption: true,
      },
      configuration: {
        type: "string",
        choices: ["Debug", "Release"],
        demandOption: true,
      },
      archs: {
        type: "string",
        demandOption: true,
        describe: "Space-separated Xcode architectures",
      },
    },
    handler: buildNative,
  })
  .demandCommand(1)
  .strict()
  .showHelpOnFail(false)
  .help()
  .parseAsync(process.argv.slice(2));
