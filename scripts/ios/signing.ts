import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { BUILD_DIR, BUNDLE_ID } from "./constants.ts";

const SIGNING_ENVIRONMENT_VARIABLES = [
  "IOS_CERTIFICATE",
  "IOS_CERTIFICATE_PASSWORD",
  "IOS_MOBILE_PROVISION",
] as const;

export type SigningConfiguration = {
  buildSettings: string[];
  exportOptionsPath: string;
};

async function readProfileValue(
  profilePlist: string,
  key: string,
): Promise<string> {
  const { stdout } = await execa("plutil", [
    "-extract",
    key,
    "raw",
    "-o",
    "-",
    profilePlist,
  ]);
  return stdout.trim();
}

function deferBestEffort(
  cleanup: AsyncDisposableStack,
  action: () => Promise<unknown>,
): void {
  cleanup.defer(async () => {
    try {
      await action();
    } catch (error) {
      console.warn("[ios] Failed to clean up signing resources", error);
    }
  });
}

function validateProvisioningProfile(
  applicationIdentifier: string,
  expirationDate: string,
): void {
  const profileBundleIdentifier = applicationIdentifier.replace(/^[^.]+\./, "");
  const matchesBundle =
    profileBundleIdentifier === BUNDLE_ID ||
    (profileBundleIdentifier.endsWith(".*") &&
      BUNDLE_ID.startsWith(profileBundleIdentifier.slice(0, -1)));
  if (!matchesBundle) {
    throw new Error(
      `Provisioning profile is for ${profileBundleIdentifier}, expected ${BUNDLE_ID}`,
    );
  }
  const expiration = new Date(expirationDate);
  if (Number.isNaN(expiration.valueOf()) || expiration <= new Date()) {
    throw new Error(
      `Provisioning profile is expired or invalid: ${expirationDate}`,
    );
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function writeExportOptions(
  outputPath: string,
  teamIdentifier: string,
  profileUuid: string,
): Promise<void> {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>teamID</key>
  <string>${escapeXml(teamIdentifier)}</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${escapeXml(BUNDLE_ID)}</key>
    <string>${escapeXml(profileUuid)}</string>
  </dict>
</dict>
</plist>
`;
  await fs.writeFile(outputPath, plist, { mode: 0o600 });
  await execa("plutil", ["-lint", outputPath]);
}

export async function prepareSigning(
  cleanup: AsyncDisposableStack,
): Promise<SigningConfiguration> {
  const environment = {
    IOS_CERTIFICATE: process.env.IOS_CERTIFICATE ?? "",
    IOS_CERTIFICATE_PASSWORD: process.env.IOS_CERTIFICATE_PASSWORD ?? "",
    IOS_MOBILE_PROVISION: process.env.IOS_MOBILE_PROVISION ?? "",
  };
  const missing = SIGNING_ENVIRONMENT_VARIABLES.filter(
    (name) => environment[name] === "",
  );
  if (missing.length > 0) {
    throw new Error(
      `iOS signing requires all signing variables; missing: ${missing.join(", ")}`,
    );
  }

  const certificate = environment.IOS_CERTIFICATE;
  const certificatePassword = environment.IOS_CERTIFICATE_PASSWORD;
  const mobileProvision = environment.IOS_MOBILE_PROVISION;
  await fs.mkdir(BUILD_DIR, { recursive: true });
  const signingDirectory = await fs.mkdtemp(path.join(BUILD_DIR, ".signing-"));
  await fs.chmod(signingDirectory, 0o700);
  deferBestEffort(cleanup, () =>
    fs.rm(signingDirectory, { recursive: true, force: true }),
  );
  const certificatePath = path.join(signingDirectory, "certificate.p12");
  const profilePath = path.join(signingDirectory, "profile.mobileprovision");
  const profilePlist = path.join(signingDirectory, "profile.plist");
  const keychainPath = path.join(signingDirectory, "signing.keychain-db");
  const exportOptionsPath = path.join(signingDirectory, "ExportOptions.plist");
  const keychainPassword = crypto.randomUUID();
  await fs.writeFile(certificatePath, certificate, { encoding: "base64" });
  await fs.writeFile(profilePath, mobileProvision, { encoding: "base64" });
  await Promise.all([
    fs.chmod(certificatePath, 0o600),
    fs.chmod(profilePath, 0o600),
  ]);
  let profileContents: string;
  try {
    ({ stdout: profileContents } = await execa("security", [
      "cms",
      "-D",
      "-i",
      profilePath,
    ]));
  } catch {
    throw new Error(
      "Failed to decode IOS_MOBILE_PROVISION; expected a base64-encoded .mobileprovision file",
    );
  }
  await fs.writeFile(profilePlist, profileContents);
  const profileUuid = await readProfileValue(profilePlist, "UUID");
  const teamIdentifier = await readProfileValue(
    profilePlist,
    "TeamIdentifier.0",
  );
  const applicationIdentifier = await readProfileValue(
    profilePlist,
    "Entitlements.application-identifier",
  );
  const expirationDate = await readProfileValue(profilePlist, "ExpirationDate");
  validateProvisioningProfile(applicationIdentifier, expirationDate);

  const { stdout: keychainList } = await execa("security", [
    "list-keychains",
    "-d",
    "user",
  ]);
  const originalKeychains = [...keychainList.matchAll(/"([^"]+)"/g)].map(
    (match) => match[1],
  );
  await execa("security", [
    "create-keychain",
    "-p",
    keychainPassword,
    keychainPath,
  ]);
  deferBestEffort(cleanup, () =>
    execa("security", ["delete-keychain", keychainPath]),
  );
  await execa("security", [
    "set-keychain-settings",
    "-lut",
    "21600",
    keychainPath,
  ]);
  await execa("security", [
    "unlock-keychain",
    "-p",
    keychainPassword,
    keychainPath,
  ]);
  try {
    await execa("security", [
      "import",
      certificatePath,
      "-k",
      keychainPath,
      "-P",
      certificatePassword,
      "-T",
      "/usr/bin/codesign",
    ]);
  } catch {
    throw new Error(
      "Failed to import IOS_CERTIFICATE; verify the certificate and password",
    );
  }
  await execa("security", [
    "set-key-partition-list",
    "-S",
    "apple-tool:,apple:,codesign:",
    "-s",
    "-k",
    keychainPassword,
    keychainPath,
  ]);
  deferBestEffort(cleanup, () =>
    execa("security", [
      "list-keychains",
      "-d",
      "user",
      "-s",
      ...originalKeychains,
    ]),
  );
  await execa("security", [
    "list-keychains",
    "-d",
    "user",
    "-s",
    keychainPath,
    ...originalKeychains,
  ]);
  const { stdout: identities } = await execa("security", [
    "find-identity",
    "-v",
    "-p",
    "codesigning",
    keychainPath,
  ]);
  const identity = identities.match(/\) ([0-9A-Fa-f]{40}) "/)?.[1];
  if (!identity) {
    throw new Error("IOS_CERTIFICATE does not contain a signing identity");
  }

  const profilesDirectory = path.join(
    os.homedir(),
    "Library/Developer/Xcode/UserData/Provisioning Profiles",
  );
  await fs.mkdir(profilesDirectory, { recursive: true });
  const installedProfilePath = path.join(
    profilesDirectory,
    `${profileUuid}.mobileprovision`,
  );
  try {
    await fs.access(installedProfilePath);
  } catch {
    await fs.writeFile(installedProfilePath, await fs.readFile(profilePath));
    deferBestEffort(cleanup, () =>
      fs.rm(installedProfilePath, { force: true }),
    );
  }

  await writeExportOptions(exportOptionsPath, teamIdentifier, profileUuid);

  return {
    buildSettings: [
      "CODE_SIGNING_ALLOWED=YES",
      "CODE_SIGNING_REQUIRED=YES",
      "CODE_SIGN_STYLE=Manual",
      `CODE_SIGN_IDENTITY=${identity}`,
      `DEVELOPMENT_TEAM=${teamIdentifier}`,
      `PROVISIONING_PROFILE_SPECIFIER=${profileUuid}`,
      `OTHER_CODE_SIGN_FLAGS=--keychain ${keychainPath}`,
    ],
    exportOptionsPath,
  };
}
