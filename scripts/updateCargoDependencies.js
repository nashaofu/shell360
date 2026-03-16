import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import got from "got";
import TOML from "smol-toml";

const DEPENDENCY_SECTION_KEYS = [
  "workspace.dependencies",
  "dependencies",
  "dev-dependencies",
  "build-dependencies",
];

/**
 * 拉取最新的包
 * @param {*} crateName
 */
async function getLatestStableVersion(crateName) {
  const url = new URL(
    `/api/v1/crates/${encodeURIComponent(crateName)}`,
    "https://crates.io",
  );

  const data = await got
    .get(url, {
      headers: {
        accept: "application/json",
      },
      retry: {
        limit: 3,
      },
      timeout: {
        request: 10000,
      },
    })
    .json();

  return data.crate.max_stable_version;
}

function isSkip(spec) {
  if (typeof spec === "string") {
    if (spec.startsWith("~")) {
      return true;
    }
    return false;
  }

  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return true;
  }

  if (spec.workspace === true) {
    return true;
  }

  if (typeof spec.path === "string") {
    return true;
  }

  if (typeof spec.git === "string") {
    return true;
  }

  if (typeof spec.version !== "string") {
    return true;
  }

  return false;
}

async function updateDependenciesVersion(dependencies = {}) {
  for (const key in dependencies) {
    console.log(`get ${key} latest version ...`);
    if (isSkip(dependencies[key])) {
      continue;
    }

    try {
      const version = await getLatestStableVersion(key);
      if (typeof dependencies[key] === "string") {
        dependencies[key] = version || dependencies[key];
      } else if (
        dependencies[key] &&
        typeof dependencies[key] === "object" &&
        !Array.isArray(dependencies[key])
      ) {
        dependencies[key] = {
          ...dependencies[key],
          version: version || dependencies[key].version,
        };
      }
    } catch (err) {
      console.error(`get ${key} latest version failed: ${err?.message}`);
    }
  }

  return dependencies;
}

async function main() {
  const files = await glob("**/Cargo.toml", {
    absolute: true,
    cwd: path.join(import.meta.dirname, ".."),
    ignore: ["**/node_modules/**", "**/target/**", "**/dist/**"],
  });

  for (const file of files) {
    console.group(`Update ${file}`);

    const source = await fs.readFile(file, { encoding: "utf-8" });
    const manifest = TOML.parse(source);

    for (const key of DEPENDENCY_SECTION_KEYS) {
      console.group(`Update ${key} version`);
      if (manifest[key]) {
        manifest[key] = await updateDependenciesVersion(manifest[key]);
      }
      console.groupEnd();
    }

    await fs.writeFile(file, `${TOML.stringify(manifest)}\n`);
    console.groupEnd();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
