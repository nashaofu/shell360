import fs from "node:fs/promises";
import os from "node:os";
import { gradlew } from "../gradle.ts";

export async function build({
  cache,
  debug,
}: {
  cache: boolean;
  debug: boolean;
}): Promise<void> {
  const signingStoreFile = `${os.tmpdir()}/android_key_jks.jks`;
  await fs.writeFile(signingStoreFile, process.env.ANDROID_KEY_JKS ?? "", {
    encoding: "base64",
  });
  const variant = debug ? "Debug" : "Release";
  const gradleArgs = [`assemble${variant}`, `bundle${variant}`];
  if (!cache) gradleArgs.push("--no-build-cache", "--rerun-tasks");
  await gradlew(gradleArgs, {
    env: {
      SIGNING_STORE_FILE: signingStoreFile,
      SIGNING_STORE_PASSWORD: process.env.ANDROID_STORE_PASSWORD,
      SIGNING_KEY_PASSWORD: process.env.ANDROID_KEY_PASSWORD,
    },
  });
}
