import fs from "node:fs";
import path from "node:path";
import { harTasks } from "@ohos/hvigor-ohos-plugin";

const { execSync } = require("node:child_process");

const CRATE_NAME = "shell360_ohrs";
const WORKSPACE_DIR = path.resolve(__dirname, "../..");
const CRATE_DIR = path.join(WORKSPACE_DIR, "crates", CRATE_NAME);
const STAGING_PACKAGE_DIR = path.join(CRATE_DIR, "package");

execSync(`ohrs build --package "${CRATE_NAME}" --release`, {
  cwd: CRATE_DIR,
  encoding: "utf8",
  windowsHide: true,
  stdio: "inherit",
});

execSync(`ohrs artifact --name "${CRATE_NAME}" --package "${CRATE_NAME}"`, {
  cwd: CRATE_DIR,
  encoding: "utf8",
  windowsHide: true,
  stdio: "inherit",
});

fs.cpSync(
  path.join(STAGING_PACKAGE_DIR, "libs"),
  path.join(__dirname, "libs"),
  { recursive: true, force: true },
);

export default {
  system: harTasks,
  plugins: [],
};
