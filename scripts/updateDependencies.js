/* eslint-disable no-console */
import path from 'path';
import fs from 'fs/promises';

import { glob } from 'glob';
import got from 'got';

/**
 * 拉取最新的包
 * @param {*} pkgName
 */
async function getLatestVersion(pkgName) {
  const headers = {
    accept:
      'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
  };

  const url = new URL(
    `${encodeURIComponent(pkgName).replace(/^%40/, '@')}/latest`,
    'https://registry.npmjs.org'
  );

  const data = await got
    .get(url, {
      headers: headers,
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

async function updateDependenciesVersion(dependencies = {}) {
  for (const key in dependencies) {
    console.log(`get ${key} latest version ...`);
    try {
      if (!dependencies[key].startsWith('workspace:*')) {
        const version = await getLatestVersion(key);
        dependencies[key] = version ? `^${version}` : dependencies[key];
      }
    } catch (err) {
      console.error(`get ${key} latest version failed: ${err?.message}`);
    }
  }

  return dependencies;
}

async function main() {
  const files = await glob('**/package.json', {
    ignore: ['node_modules/**', 'target/**', 'dist/**'],
    cwd: path.join(import.meta.dirname, '..'),
    absolute: true,
  });

  for (const file of files) {
    console.group(`Update ${file}`);
    const pkg = await fs.readFile(file, { encoding: 'utf-8' });
    const pkgInfo = JSON.parse(pkg);

    console.group('Update dependencies version');
    if (pkgInfo.dependencies) {
      pkgInfo.dependencies = await updateDependenciesVersion(
        pkgInfo.dependencies
      );
    }
    console.groupEnd();

    console.group('Update devDependencies version');
    if (pkgInfo.devDependencies) {
      pkgInfo.devDependencies = await updateDependenciesVersion(
        pkgInfo.devDependencies
      );
    }
    console.groupEnd();

    await fs.writeFile(file, `${JSON.stringify(pkgInfo, null, 2)}\n`);
    console.groupEnd();
  }
}

main();
