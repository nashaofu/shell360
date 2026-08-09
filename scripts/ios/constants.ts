import path from "node:path";
import url from "node:url";

export const WORKSPACE_DIR = url.fileURLToPath(
  new URL("../../", import.meta.url),
);
export const IOS_DIR = path.join(WORKSPACE_DIR, "ios");
export const PROJECT_PATH = path.join(IOS_DIR, "shell360.xcodeproj");
export const SCHEME = "shell360";
export const BUNDLE_ID = "com.nashaofu.shell360";
export const DEV_SERVER_PORT = 1421;
export const BUILD_DIR = path.join(IOS_DIR, "build");
export const ARCHIVE_PATH = path.join(BUILD_DIR, "shell360.xcarchive");
export const IPA_PATH = path.join(BUILD_DIR, "shell360.ipa");
export const DERIVED_DATA_PATH = path.join(BUILD_DIR, "DerivedData");
export const IS_MACOS = process.platform === "darwin";
