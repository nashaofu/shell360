import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HARMONYOS_DIR } from "./constants.ts";

const BUILD_PROFILE_PATH = path.join(HARMONYOS_DIR, "build-profile.json5");
const HARMONYOS_KEY_ALIAS = "upload";

type SigningEnvironment = {
  p12: string;
  cer: string;
  p7b: string;
  storePassword: string;
  keyPassword: string;
};

const SIGNING_ENVIRONMENT_VARIABLES = [
  ["p12", "HARMONYOS_SIGNING_P12_B64"],
  ["cer", "HARMONYOS_SIGNING_CER_B64"],
  ["p7b", "HARMONYOS_SIGNING_P7B_B64"],
  ["storePassword", "HARMONYOS_SIGNING_STORE_PASSWORD"],
  ["keyPassword", "HARMONYOS_SIGNING_KEY_PASSWORD"],
] as const satisfies ReadonlyArray<readonly [keyof SigningEnvironment, string]>;

function deferBestEffort(
  cleanup: AsyncDisposableStack,
  action: () => Promise<unknown>,
): void {
  cleanup.defer(async () => {
    try {
      await action();
    } catch (error) {
      console.warn("[harmonyos] Failed to clean up signing resources", error);
    }
  });
}

export async function prepareSigning(
  cleanup: AsyncDisposableStack,
): Promise<void> {
  const environment: SigningEnvironment = {
    p12: process.env.HARMONYOS_SIGNING_P12_B64 ?? "",
    cer: process.env.HARMONYOS_SIGNING_CER_B64 ?? "",
    p7b: process.env.HARMONYOS_SIGNING_P7B_B64 ?? "",
    storePassword: process.env.HARMONYOS_SIGNING_STORE_PASSWORD ?? "",
    keyPassword: process.env.HARMONYOS_SIGNING_KEY_PASSWORD ?? "",
  };
  const missing = SIGNING_ENVIRONMENT_VARIABLES.filter(
    ([key]) => environment[key] === "",
  );
  if (missing.length > 0) {
    throw new Error(
      `HarmonyOS signing requires all signing variables; missing: ${missing
        .map(([, name]) => name)
        .join(", ")}`,
    );
  }

  const signingDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "shell360-harmonyos-signing-"),
  );
  await fs.chmod(signingDirectory, 0o700);
  deferBestEffort(cleanup, () =>
    fs.rm(signingDirectory, { recursive: true, force: true }),
  );

  const p12Path = path.join(signingDirectory, "app.p12");
  const cerPath = path.join(signingDirectory, "app.cer");
  const p7bPath = path.join(signingDirectory, "app.p7b");
  await Promise.all([
    writeBase64File(p12Path, environment.p12),
    writeBase64File(cerPath, environment.cer),
    writeBase64File(p7bPath, environment.p7b),
  ]);

  const original = await fs.readFile(BUILD_PROFILE_PATH, "utf8");
  const material = {
    storeFile: p12Path,
    certpath: cerPath,
    profile: p7bPath,
    storePassword: environment.storePassword,
    keyAlias: HARMONYOS_KEY_ALIAS,
    keyPassword: environment.keyPassword,
    signAlg: "SHA256withECDSA",
  };
  const configured = original.replace(
    "signingConfigs: [],",
    `signingConfigs: [{
      name: "default",
      material: ${JSON.stringify(material, null, 2)},
    }],`,
  );
  if (configured === original) {
    throw new Error(
      `Could not inject HarmonyOS signing configuration into ${BUILD_PROFILE_PATH}`,
    );
  }

  await fs.writeFile(BUILD_PROFILE_PATH, configured, "utf8");
  deferBestEffort(cleanup, () => fs.writeFile(BUILD_PROFILE_PATH, original));
}

async function writeBase64File(filePath: string, value: string): Promise<void> {
  await fs.writeFile(filePath, value, {
    encoding: "base64",
    mode: 0o600,
  });
  const { size } = await fs.stat(filePath);
  if (size === 0) {
    throw new Error(`Failed to decode HarmonyOS signing file: ${filePath}`);
  }
}
