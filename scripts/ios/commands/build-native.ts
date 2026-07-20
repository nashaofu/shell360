import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { IOS_DIR, WORKSPACE_DIR } from "../constants.ts";

const GENERATED_ROOT = path.join(IOS_DIR, "shell360", "Generated");
const FFI_PACKAGE = "shell360-ffi";

export type NativePlatform = "iphoneos" | "iphonesimulator";
export type NativeConfiguration = "Debug" | "Release";

type BuildNativeOptions = {
  platform: NativePlatform;
  configuration: NativeConfiguration;
  archs: string;
};

function resolveRustTarget(
  platform: NativePlatform,
  architecture: string,
): string {
  if (platform === "iphoneos" && architecture === "arm64") {
    return "aarch64-apple-ios";
  }
  if (platform === "iphonesimulator" && architecture === "arm64") {
    return "aarch64-apple-ios-sim";
  }
  if (platform === "iphonesimulator" && architecture === "x86_64") {
    return "x86_64-apple-ios";
  }
  throw new Error(`Unsupported iOS target: ${platform}/${architecture}`);
}

async function buildRustLibrary(
  target: string,
  release: boolean,
): Promise<string> {
  await execa(
    "cargo",
    [
      "build",
      "--manifest-path",
      path.join(WORKSPACE_DIR, "Cargo.toml"),
      "-p",
      FFI_PACKAGE,
      "--target",
      target,
      ...(release ? ["--release"] : []),
    ],
    { cwd: WORKSPACE_DIR, stdio: "inherit" },
  );
  return path.join(
    WORKSPACE_DIR,
    "target",
    target,
    release ? "release" : "debug",
    "libshell360_ffi.a",
  );
}

async function generateSwiftBindings(library: string): Promise<void> {
  await fs.mkdir(GENERATED_ROOT, { recursive: true });
  await execa(
    "cargo",
    [
      "run",
      "--manifest-path",
      path.join(WORKSPACE_DIR, "Cargo.toml"),
      "-p",
      FFI_PACKAGE,
      "--bin",
      "uniffi-bindgen",
      "--",
      "generate",
      library,
      "--language",
      "swift",
      "--out-dir",
      GENERATED_ROOT,
      "--no-format",
    ],
    { cwd: WORKSPACE_DIR, stdio: "inherit" },
  );
  await fs.writeFile(
    path.join(GENERATED_ROOT, "module.modulemap"),
    'module shell360_ffiFFI {\n  header "shell360_ffiFFI.h"\n  export *\n}\n',
  );
}

async function assemblePlatformLibrary(
  libraries: string[],
  output: string,
): Promise<void> {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.rm(output, { recursive: true, force: true });
  if (libraries.length === 1) {
    await fs.cp(libraries[0], output);
    return;
  }
  await execa("lipo", ["-create", ...libraries, "-output", output], {
    cwd: WORKSPACE_DIR,
    stdio: "inherit",
  });
}

export async function buildNative({
  platform,
  configuration,
  archs,
}: BuildNativeOptions): Promise<void> {
  const architectures = [...new Set(archs.trim().split(/\s+/).filter(Boolean))];
  if (architectures.length === 0) {
    throw new Error("No iOS architectures provided");
  }
  const release = configuration === "Release";
  const libraries = await Promise.all(
    architectures.map((architecture) =>
      buildRustLibrary(resolveRustTarget(platform, architecture), release),
    ),
  );
  const output = path.join(
    IOS_DIR,
    "Generated",
    "Rust",
    configuration,
    platform,
    "libshell360_ffi.a",
  );
  await assemblePlatformLibrary(libraries, output);
  await generateSwiftBindings(libraries[0]);
  console.log(
    `[ios] Generated ${configuration} ${platform} native artifacts for ${architectures.join(", ")}`,
  );
}
