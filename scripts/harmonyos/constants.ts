import path from "node:path";
import url from "node:url";

export const WORKSPACE_DIR = url.fileURLToPath(
  new URL("../../", import.meta.url),
);
export const HARMONYOS_DIR = path.join(WORKSPACE_DIR, "harmonyos");
export const HARMONYOS_BUILD_DIR = path.join(WORKSPACE_DIR, "build");

export const DEVECO_HOME = process.env.DEVECO_HOME ?? "";
export const DEVECO_SDK_HOME = process.env.DEVECO_SDK_HOME ?? "";
export const DEVECO_CLI_STUDIO_PATH =
  process.env.DEVECO_CLI_STUDIO_PATH ?? DEVECO_HOME;
export const DEVECO_CLI_CLT_PATH = process.env.DEVECO_CLI_CLT_PATH ?? "";

export const OHOS_TOOLCHAINS_DIR = path.join(
  DEVECO_SDK_HOME ?? "",
  "default/openharmony/toolchains",
);

export const OHPM = path.join(
  DEVECO_HOME,
  "tools",
  "ohpm",
  "bin",
  process.platform === "win32" ? "ohpm.bat" : "ohpm",
);

export const HVIGORW = path.join(
  DEVECO_HOME,
  "tools",
  "hvigor",
  "bin",
  process.platform === "win32" ? "hvigorw.bat" : "hvigorw",
);

export const HDC = path.join(
  OHOS_TOOLCHAINS_DIR,
  process.platform === "win32" ? `hdc.exe` : `hdc`,
);

export const OHOS_PATH = [OHOS_TOOLCHAINS_DIR, process.env.PATH]
  .filter((entry): entry is string => Boolean(entry))
  .join(path.delimiter);
