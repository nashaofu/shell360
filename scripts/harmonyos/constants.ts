import path from "node:path";
import url from "node:url";

export const WORKSPACE_DIR = url.fileURLToPath(
  new URL("../../", import.meta.url),
);
export const HARMONYOS_DIR = path.join(WORKSPACE_DIR, "harmonyos");

export const DEVECO_HOME = process.env.DEVECO_HOME;
export const DEVECO_SDK_HOME = process.env.DEVECO_SDK_HOME;

export const OHOS_TOOLCHAINS_DIR = path.join(
  DEVECO_SDK_HOME ?? "",
  "default/openharmony/toolchains",
);

export const HVIGORW = path.join(
  DEVECO_HOME ?? "",
  "tools",
  "hvigor",
  "bin",
  process.platform === "win32" ? "hvigorw.bat" : "hvigorw",
);

export const HDC = path.join(
  OHOS_TOOLCHAINS_DIR,
  process.platform === "win32" ? `hdc.exe` : `hdc`,
);

export const EMULATOR = path.join(
  DEVECO_HOME ?? "",
  "tools",
  "emulator",
  process.platform === "win32" ? "Emulator.exe" : "Emulator",
);

export const EMULATOR_INSTANCE_DIR = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Huawei",
  "Emulator",
  "deployed",
);

export const OHOS_PATH = [OHOS_TOOLCHAINS_DIR, process.env.PATH]
  .filter((entry): entry is string => Boolean(entry))
  .join(path.delimiter);

export const HARMONYOS_BUNDLE_NAME = "com.nashaofu.shell360";

export const HARMONYOS_NATIVE_LIBS_DIR = path.join(
  HARMONYOS_DIR,
  "entry",
  "libs",
);
export const WEB_ASSETS_DIR = path.join(
  HARMONYOS_DIR,
  "entry",
  "src",
  "main",
  "resources",
  "rawfile",
  "www",
);
