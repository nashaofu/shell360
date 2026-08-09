import { ARCHIVE_PATH, BUILD_DIR, PROJECT_PATH, SCHEME } from "../constants.ts";
import { xcodebuild } from "../xcode.ts";

export async function build({
  archive,
  cache,
}: {
  archive: boolean;
  cache: boolean;
}): Promise<void> {
  const args = [
    "-project",
    PROJECT_PATH,
    "-scheme",
    SCHEME,
    "-configuration",
    "Release",
    "-sdk",
    archive ? "iphoneos" : "iphonesimulator",
    ...(archive
      ? [
          "-archivePath",
          ARCHIVE_PATH,
          ...(cache ? ["archive"] : ["clean", "archive"]),
        ]
      : [
          "-derivedDataPath",
          `${BUILD_DIR}/DerivedData`,
          ...(cache ? ["build"] : ["clean", "build"]),
        ]),
  ];
  await xcodebuild(args, {
    env: {
      ...process.env,
      CODE_SIGNING_ALLOWED: archive
        ? (process.env.CODE_SIGNING_ALLOWED ?? "NO")
        : "NO",
      CODE_SIGNING_REQUIRED: archive
        ? (process.env.CODE_SIGNING_REQUIRED ?? "NO")
        : "NO",
    },
  });
}
