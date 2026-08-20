import { harTasks } from "@ohos/hvigor-ohos-plugin";

const { execSync } = require("node:child_process");
const path = require("node:path");

const CRATE_NAME = "shell360_ohrs";
const CRATE_DIR = path.resolve(__dirname, "..");

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

export default {
  system: harTasks /* Built-in plugin of Hvigor. It cannot be modified. */,
  plugins: [] /* Custom plugin to extend the functionality of Hvigor. */,
};
