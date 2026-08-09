import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../../", import.meta.url));

export const WORKSPACE_DIR = ROOT_DIR;
export { ROOT_DIR };
export const IOS_DIR = path.join(ROOT_DIR, "ios");
export const PROJECT_PATH = path.join(IOS_DIR, "shell360.xcodeproj");
export const SCHEME = "shell360";
export const BUNDLE_ID = "com.nashaofu.shell360";
export const DEV_SERVER_PORT = 1421;
export const BUILD_DIR = path.join(ROOT_DIR, "build");
export const ARCHIVE_PATH = path.join(BUILD_DIR, "shell360.xcarchive");
export const IS_MACOS = process.platform === "darwin";
