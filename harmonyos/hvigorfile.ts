import fs from "node:fs";
import path from "node:path";
import { hvigor } from "@ohos/hvigor";
import {
  appTasks,
  type OhosAppContext,
  OhosPluginId,
} from "@ohos/hvigor-ohos-plugin";

const workspaceDir = path.resolve(__dirname, "..");
const tauriConfigPath = path.join(workspaceDir, "src-tauri", "tauri.conf.json");

hvigor.afterNodeEvaluate((node) => {
  const appContext = node.getContext(
    OhosPluginId.OHOS_APP_PLUGIN,
  ) as OhosAppContext;
  if (!appContext) {
    return;
  }

  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8")) as {
    version?: string;
  };
  const version = tauriConfig.version;
  if (!version) {
    throw new Error(`Unable to read version from ${tauriConfigPath}`);
  }

  const versionName = version.split("-")[0];
  const versionParts = versionName
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  const versionCode =
    versionParts[0] * 1_000_000 + versionParts[1] * 1_000 + versionParts[2];

  const appJsonOpt = appContext.getAppJsonOpt();
  appJsonOpt.app.versionName = versionName;
  appJsonOpt.app.versionCode = versionCode;
  appContext.setAppJsonOpt(appJsonOpt);
});

export default {
  system: appTasks /* Built-in plugin of Hvigor. It cannot be modified. */,
  plugins: [] /* Custom plugin to extend the functionality of Hvigor. */,
};
