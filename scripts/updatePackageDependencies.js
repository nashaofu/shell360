import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import got from "got";

const DEPENDENCY_SECTION_KEYS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

/**
 * 拉取最新的包
 * @param {*} pkgName
 */
async function getLatestStableVersion(pkgName) {
  const url = new URL(
    `${encodeURIComponent(pkgName).replace(/^%40/, "@")}/latest`,
    "https://registry.npmjs.org",
  );

  const data = await got
    .get(url, {
      headers: {
        accept:
          "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
      },
      retry: {
        limit: 3,
      },
      timeout: {
        request: 10000,
      },
    })
    .json();

  return data.version;
}

function isSkip(spec) {
  if (typeof spec !== "string") {
    return true;
  }

  if (spec.startsWith("workspace:")) {
    return true;
  }

  if (spec.startsWith("file:")) {
    return true;
  }

  if (spec.startsWith("git+")) {
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
      dependencies[key] = version ? `^${version}` : dependencies[key];
    } catch (err) {
      console.error(`get ${key} latest version failed: ${err?.message}`);
    }
  }

  return dependencies;
}

async function main() {
  const files = await glob("**/package.json", {
    absolute: true,
    cwd: path.join(import.meta.dirname, ".."),
    ignore: ["node_modules/**", "target/**", "dist/**"],
  });

  for (const file of files) {
    console.group(`Update ${file}`);
    const source = await fs.readFile(file, { encoding: "utf-8" });
    const pkgInfo = JSON.parse(source);

    for (const key of DEPENDENCY_SECTION_KEYS) {
      console.group(`Update ${key} version`);
      if (pkgInfo[key]) {
        pkgInfo[key] = await updateDependenciesVersion(pkgInfo[key]);
      }
      console.groupEnd();
    }

    await fs.writeFile(file, `${JSON.stringify(pkgInfo, null, 2)}\n`);
    console.groupEnd();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
