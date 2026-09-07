import {
  createCipheriv,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSON5 from "json5";
import { HARMONYOS_DIR } from "./constants.ts";

const BUILD_PROFILE_PATH = path.join(HARMONYOS_DIR, "build-profile.json5");
const HARMONYOS_KEY_ALIAS = "upload";
const SIGNING_COMPONENT = Buffer.from([
  49, 243, 9, 115, 214, 175, 91, 184, 211, 190, 177, 88, 101, 131, 192, 119,
]);

type SigningEnvironment = {
  p12: string;
  cer: string;
  p7b: string;
  storePassword: string;
  keyPassword: string;
};

const SIGNING_ENVIRONMENT_VARIABLES = [
  ["p12", "HARMONYOS_SIGNING_P12"],
  ["cer", "HARMONYOS_SIGNING_CER"],
  ["p7b", "HARMONYOS_SIGNING_P7B"],
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
    p12: process.env.HARMONYOS_SIGNING_P12 ?? "",
    cer: process.env.HARMONYOS_SIGNING_CER ?? "",
    p7b: process.env.HARMONYOS_SIGNING_P7B ?? "",
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
  const encryptionKey = await createSigningMaterial(signingDirectory);

  const original = await fs.readFile(BUILD_PROFILE_PATH, "utf8");
  const material = {
    storeFile: p12Path,
    certpath: cerPath,
    profile: p7bPath,
    storePassword: encryptPassword(encryptionKey, environment.storePassword),
    keyAlias: HARMONYOS_KEY_ALIAS,
    keyPassword: encryptPassword(encryptionKey, environment.keyPassword),
    signAlg: "SHA256withECDSA",
  };
  const profile = JSON5.parse(original) as {
    app?: { signingConfigs?: unknown[] };
  };
  if (!profile.app) {
    throw new Error(`Missing app configuration in ${BUILD_PROFILE_PATH}`);
  }
  profile.app.signingConfigs = [
    {
      name: "default",
      type: "HarmonyOS",
      material,
    },
  ];
  const configured = `${JSON5.stringify(profile, null, 2)}\n`;

  await fs.writeFile(BUILD_PROFILE_PATH, configured, "utf8");
  deferBestEffort(cleanup, () => fs.writeFile(BUILD_PROFILE_PATH, original));
}

async function createSigningMaterial(
  signingDirectory: string,
): Promise<Buffer> {
  const materialDirectory = path.join(signingDirectory, "material");
  const fdDirectory = path.join(materialDirectory, "fd");
  const acDirectory = path.join(materialDirectory, "ac");
  const ceDirectory = path.join(materialDirectory, "ce");
  const components = [randomBytes(16), randomBytes(16), randomBytes(16)];
  const salt = randomBytes(16);

  await Promise.all([
    ...components.map(async (component, index) => {
      const directory = path.join(fdDirectory, String(index));
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, randomUUID()), component, {
        mode: 0o600,
      });
    }),
    fs.mkdir(acDirectory, { recursive: true }),
    fs.mkdir(ceDirectory, { recursive: true }),
  ]);
  await fs.writeFile(path.join(acDirectory, randomUUID()), salt, {
    mode: 0o600,
  });

  const rootComponent = components
    .concat(SIGNING_COMPONENT)
    .reduce((result, component) =>
      result.map((value, index) => value ^ component[index]),
    );
  const rootKey = pbkdf2Sync(
    rootComponent.toString(),
    salt,
    10_000,
    16,
    "sha256",
  );
  const encryptionKey = randomBytes(16);
  await fs.writeFile(
    path.join(ceDirectory, randomUUID()),
    encrypt(rootKey, encryptionKey),
    { mode: 0o600 },
  );
  return encryptionKey;
}

function encryptPassword(key: Buffer, password: string): string {
  return encrypt(key, Buffer.from(password)).toString("hex");
}

function encrypt(key: Buffer, value: Buffer): Buffer {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-128-gcm", key, initializationVector);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(encrypted.length + authenticationTag.length);
  return Buffer.concat([
    length,
    initializationVector,
    encrypted,
    authenticationTag,
  ]);
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
