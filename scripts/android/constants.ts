import path from "node:path";
import url from "node:url";

export const WORKSPACE_DIR = url.fileURLToPath(
  new URL("../../", import.meta.url),
);
export const ANDROID_DIR = path.join(WORKSPACE_DIR, "android");
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
