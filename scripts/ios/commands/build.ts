import fs from "node:fs/promises";
import path from "node:path";
import {
  ARCHIVE_PATH,
  BUILD_DIR,
  DERIVED_DATA_PATH,
  IPA_PATH,
  PROJECT_PATH,
  SCHEME,
} from "../constants.ts";
import { prepareSigning } from "../signing.ts";
import { xcodebuild } from "../xcode.ts";

export async function build({ cache }: { cache: boolean }): Promise<void> {
  await using cleanup = new AsyncDisposableStack();
  const signing = await prepareSigning(cleanup);
  const args = [
    "-project",
    PROJECT_PATH,
    "-scheme",
    SCHEME,
    "-configuration",
    "Release",
    "-sdk",
    "iphoneos",
    "-destination",
    "generic/platform=iOS",
    "-derivedDataPath",
    DERIVED_DATA_PATH,
    "-archivePath",
    ARCHIVE_PATH,
  ];
  if (!cache) {
    args.push("clean");
  }
  args.push("archive", ...signing.buildSettings);

  await fs.rm(ARCHIVE_PATH, { recursive: true, force: true });
  await xcodebuild(args);
  await fs.rm(IPA_PATH, { force: true });
  await xcodebuild([
    "-exportArchive",
    "-archivePath",
    ARCHIVE_PATH,
    "-exportPath",
    BUILD_DIR,
    "-exportOptionsPlist",
    signing.exportOptionsPath,
  ]);
  // const exportedFiles = await fs.readdir(BUILD_DIR);
  // const exportedIpas = exportedFiles.filter((file) => file.endsWith(".ipa"));
  // if (exportedIpas.length !== 1) {
  //   throw new Error(
  //     `Expected one exported IPA, found ${exportedIpas.length}: ${exportedIpas.join(", ")}`,
  //   );
  // }
  // const exportedIpaPath = path.join(BUILD_DIR, exportedIpas[0]);
  // if (exportedIpaPath !== IPA_PATH) {
  //   await fs.rename(exportedIpaPath, IPA_PATH);
  // }
  console.log(`[ios] Exported IPA to ${IPA_PATH}`);
}
