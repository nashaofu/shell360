import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { IOS_DIR, ROOT_DIR, WORKSPACE_DIR } from "./constants.ts";

const GENERATED_ROOT = path.join(IOS_DIR, "shell360", "Generated");
const RUST_OUTPUT = path.join(IOS_DIR, "Generated", "Rust");
const XCFRAMEWORK_OUTPUT = path.join(
  IOS_DIR,
  "Generated",
  "Shell360FFI.xcframework",
);
const HEADERS_OUTPUT = path.join(IOS_DIR, "Generated", "Headers");
const FFI_PACKAGE = "shell360-ffi";

function run(command: string, args: string[]) {
  return execa(command, args, { cwd: WORKSPACE_DIR, stdio: "inherit" });
}

export async function buildWebAssets(): Promise<void> {
  const webAssets = path.join(IOS_DIR, "shell360", "WebAssets");
  await run("pnpm", ["--filter", "mobile", "run", "build"]);
  await rm(webAssets, { recursive: true, force: true });
  await mkdir(webAssets, { recursive: true });
  await cp(path.join(ROOT_DIR, "mobile", "dist"), webAssets, {
    recursive: true,
  });
  console.log(`[ios] Copied mobile/dist into ${webAssets}`);
}

export async function generateUniffi(): Promise<void> {
  const deviceRust = path.join(
    ROOT_DIR,
    "target",
    "aarch64-apple-ios",
    "release",
  );
  const simulatorRust = path.join(
    ROOT_DIR,
    "target",
    "aarch64-apple-ios-sim",
    "release",
  );
  const intelSimulatorRust = path.join(
    ROOT_DIR,
    "target",
    "x86_64-apple-ios",
    "release",
  );
  await mkdir(path.join(RUST_OUTPUT, "iphoneos"), { recursive: true });
  await mkdir(path.join(RUST_OUTPUT, "iphonesimulator"), { recursive: true });
  await mkdir(GENERATED_ROOT, { recursive: true });

  if (process.env.SKIP_RUST_BUILD !== "1") {
    await run("cargo", [
      "build",
      "--manifest-path",
      path.join(ROOT_DIR, "Cargo.toml"),
      "-p",
      FFI_PACKAGE,
      "--target",
      "aarch64-apple-ios",
      "--release",
    ]);
    await run("cargo", [
      "build",
      "--manifest-path",
      path.join(ROOT_DIR, "Cargo.toml"),
      "-p",
      FFI_PACKAGE,
      "--target",
      "aarch64-apple-ios-sim",
      "--release",
    ]);
    await run("cargo", [
      "build",
      "--manifest-path",
      path.join(ROOT_DIR, "Cargo.toml"),
      "-p",
      FFI_PACKAGE,
      "--target",
      "x86_64-apple-ios",
      "--release",
    ]);
  }

  const deviceLibrary = path.join(deviceRust, "libshell360_ffi.a");
  await run("cargo", [
    "run",
    "--manifest-path",
    path.join(ROOT_DIR, "Cargo.toml"),
    "-p",
    FFI_PACKAGE,
    "--bin",
    "uniffi-bindgen",
    "--",
    "generate",
    deviceLibrary,
    "--language",
    "swift",
    "--out-dir",
    GENERATED_ROOT,
    "--no-format",
  ]);
  await cp(
    deviceLibrary,
    path.join(RUST_OUTPUT, "iphoneos", "libshell360_ffi.a"),
  );

  const simulatorLibrary = path.join(simulatorRust, "libshell360_ffi.a");
  const intelSimulatorLibrary = path.join(
    intelSimulatorRust,
    "libshell360_ffi.a",
  );
  const outputSimulatorLibrary = path.join(
    RUST_OUTPUT,
    "iphonesimulator",
    "libshell360_ffi.a",
  );
  try {
    await readFile(intelSimulatorLibrary);
    await run("lipo", [
      "-create",
      simulatorLibrary,
      intelSimulatorLibrary,
      "-output",
      outputSimulatorLibrary,
    ]);
  } catch {
    await cp(simulatorLibrary, outputSimulatorLibrary);
    console.warn(
      "[ios] x86_64 simulator library unavailable; emitted arm64 simulator library.",
    );
  }

  await writeFile(
    path.join(GENERATED_ROOT, "shell360_ffiFFI.modulemap"),
    'module shell360_ffiFFI {\n  header "shell360_ffiFFI.h"\n  export *\n}\n',
  );
  await rm(HEADERS_OUTPUT, { recursive: true, force: true });
  await rm(XCFRAMEWORK_OUTPUT, { recursive: true, force: true });
  await mkdir(HEADERS_OUTPUT, { recursive: true });
  await cp(path.join(GENERATED_ROOT, "shell360_ffiFFI.h"), HEADERS_OUTPUT);
  await cp(
    path.join(GENERATED_ROOT, "shell360_ffiFFI.modulemap"),
    path.join(HEADERS_OUTPUT, "module.modulemap"),
  );
  await run("xcodebuild", [
    "-create-xcframework",
    "-library",
    path.join(RUST_OUTPUT, "iphoneos", "libshell360_ffi.a"),
    "-headers",
    HEADERS_OUTPUT,
    "-library",
    outputSimulatorLibrary,
    "-headers",
    HEADERS_OUTPUT,
    "-output",
    XCFRAMEWORK_OUTPUT,
  ]);
  console.log(`[ios] Generated UniFFI Swift bindings at ${GENERATED_ROOT}`);
}
