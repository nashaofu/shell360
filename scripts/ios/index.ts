import { existsSync } from "node:fs";
import yargs from "yargs";
import { archiveIOS, buildIOS, devIOS } from "./commands.ts";
import { IS_MACOS, PROJECT_PATH } from "./constants.ts";
import { buildWebAssets, generateUniffi } from "./generation.ts";

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
    handler: devIOS,
  })
  .command<{ cache: boolean }>({
    command: "build",
    describe: "Build the iOS Release app for simulator",
    builder: {
      cache: {
        type: "boolean",
        default: false,
        describe: "Reuse Xcode build outputs",
      },
    },
    handler: buildIOS,
  })
  .command("archive", "Create an iOS Release archive", {}, archiveIOS)
  .command("web-assets", "Build and copy mobile web assets", {}, buildWebAssets)
  .command(
    "generate-uniffi",
    "Build Rust libraries and generate UniFFI outputs",
    {},
    generateUniffi,
  )
  .demandCommand(1)
  .strict()
  .showHelpOnFail(false)
  .help()
  .parseAsync(process.argv.slice(2));
