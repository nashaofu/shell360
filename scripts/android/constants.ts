import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../../", import.meta.url));

export const WORKSPACE_DIR = ROOT_DIR;
export const ANDROID_DIR = path.join(ROOT_DIR, "android");
export const IS_WINDOWS = process.platform === "win32";
export const ANDROID_HOME = process.env.ANDROID_HOME;
export const DEV_SERVER_PORT = 1421;

export const ADB_PATH = path.join(
  ANDROID_HOME ?? "",
  "platform-tools",
  IS_WINDOWS ? "adb.exe" : "adb",
);

export const GRADLE_PATH = path.join(
  ANDROID_DIR,
  IS_WINDOWS ? "gradlew.bat" : "gradlew",
);

export const EMULATOR_PATH = path.join(
  ANDROID_HOME ?? "",
  "emulator",
  IS_WINDOWS ? "emulator.exe" : "emulator",
);

export const ANDROID_PACKAGE_NAME = "com.nashaofu.shell360";
