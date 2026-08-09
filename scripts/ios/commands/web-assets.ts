import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { IOS_DIR, WORKSPACE_DIR } from "../constants.ts";

export async function webAssets(): Promise<void> {
  const webAssetsPath = path.join(IOS_DIR, "shell360", "WebAssets");
  await execa("pnpm", ["--filter", "mobile", "run", "build"], {
    cwd: WORKSPACE_DIR,
    stdio: "inherit",
  });
  await rm(webAssetsPath, { recursive: true, force: true });
  await mkdir(webAssetsPath, { recursive: true });
  await cp(path.join(WORKSPACE_DIR, "mobile", "dist"), webAssetsPath, {
    recursive: true,
  });
  console.log(`[ios] Copied mobile/dist into ${webAssetsPath}`);
}
