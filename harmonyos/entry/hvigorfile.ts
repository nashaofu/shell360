import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { hvigor } from "@ohos/hvigor";
import {
  hapTasks,
  type OhosHapContext,
  OhosPluginId,
} from "@ohos/hvigor-ohos-plugin";

const host = hvigor.getParameter().getExtParam("devServerHost") ?? "127.0.0.1";
const port = Number(
  hvigor.getParameter().getExtParam("devServerPort") ?? "1421",
);

const workspaceDir = path.resolve(__dirname, "..", "..");

hvigor.afterNodeEvaluate((node) => {
  const hapContext = node.getContext(
    OhosPluginId.OHOS_HAP_PLUGIN,
  ) as OhosHapContext;
  if (!hapContext) {
    return;
  }
  const buildMode = hapContext.getBuildMode();

  const webAssetsDir = path.join(
    hapContext.getModulePath(),
    "src",
    "main",
    "resources",
    "rawfile",
    "www",
  );
  if (buildMode === "debug") {
    fs.mkdirSync(webAssetsDir, { recursive: true });
    fs.writeFileSync(
      path.join(webAssetsDir, "index.html"),
      "<!doctype html><html><body></body></html>\n",
    );
  } else if (buildMode === "release") {
    const mobileDir = path.join(workspaceDir, "mobile");
    execSync("npm run build", {
      cwd: mobileDir,
      env: {
        ...process.env,
        ENV_PLATFORM: "harmonyos",
      },
      stdio: "inherit",
    });
    fs.rmSync(webAssetsDir, { recursive: true, force: true });
    fs.mkdirSync(webAssetsDir, { recursive: true });
    fs.cpSync(path.join(mobileDir, "dist"), webAssetsDir, { recursive: true });
  }

  const buildProfile = hapContext.getBuildProfileOpt();
  const buildProfileFields = {
    ...buildProfile.buildOption?.arkOptions?.buildProfileFields,
    HARMONYOS_DEV_HOST: host,
    HARMONYOS_DEV_PORT: port,
  };

  buildProfile.buildOption ??= {};
  buildProfile.buildOption.arkOptions ??= {};
  buildProfile.buildOption.arkOptions.buildProfileFields = buildProfileFields;
  hapContext.setBuildProfileOpt(buildProfile);
});

export default {
  system: hapTasks /* Built-in plugin of Hvigor. It cannot be modified. */,
  plugins: [] /* Custom plugin to extend the functionality of Hvigor. */,
};
