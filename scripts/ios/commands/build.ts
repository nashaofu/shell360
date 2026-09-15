import fs from "node:fs/promises";
import path from "node:path";
import { moveArtifacts } from "../../utils/artifacts.ts";
import {
  ARCHIVE_PATH,
  BUILD_DIR,
  DERIVED_DATA_PATH,
  IOS_BUILD_DIR,
  PROJECT_PATH,
  SCHEME,
} from "../constants.ts";
import { prepareSigning } from "../signing.ts";
import { readIosVersion } from "../version.ts";
import { xcodebuild } from "../xcode.ts";

const EXPORT_PATH = path.join(BUILD_DIR, "export");

export async function build({ cache }: { cache: boolean }): Promise<void> {
  await using cleanup = new AsyncDisposableStack();
  const version = await readIosVersion();
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
  args.push(
    "archive",
    `MARKETING_VERSION=${version.marketingVersion}`,
    `CURRENT_PROJECT_VERSION=${version.buildVersion}`,
    ...signing.buildSettings,
  );

  await fs.rm(ARCHIVE_PATH, { recursive: true, force: true });
  await xcodebuild(args);
  await fs.rm(EXPORT_PATH, { recursive: true, force: true });
  await xcodebuild([
    "-exportArchive",
    "-archivePath",
    ARCHIVE_PATH,
    "-exportPath",
    EXPORT_PATH,
    "-exportOptionsPlist",
    signing.exportOptionsPath,
  ]);
  await moveArtifacts(path.join(EXPORT_PATH, "*.ipa"), IOS_BUILD_DIR);
}
