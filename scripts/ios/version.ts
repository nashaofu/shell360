import fs from "node:fs/promises";
import path from "node:path";
import { WORKSPACE_DIR } from "./constants.ts";

type TauriConfig = { version?: unknown };

const VERSION_PART_COUNT = 3;

export type IosVersion = {
  marketingVersion: string;
  buildVersion: string;
};

export async function readIosVersion(): Promise<IosVersion> {
  const configPath = path.join(WORKSPACE_DIR, "src-tauri", "tauri.conf.json");
  const config = JSON.parse(
    await fs.readFile(configPath, "utf8"),
  ) as TauriConfig;
  if (typeof config.version !== "string") {
    throw new Error(`Unable to read version from ${configPath}`);
  }
  const marketingVersion = config.version.split("-")[0];
  const parts = marketingVersion.split(".");
  if (
    parts.length !== VERSION_PART_COUNT ||
    parts.some((part) => !/^\d+$/.test(part))
  ) {
    throw new Error(`Invalid Tauri version: ${config.version}`);
  }
  const buildNumber = String(Math.floor(Date.now() / 60_000));
  return {
    marketingVersion,
    buildVersion: buildNumber,
  };
}
