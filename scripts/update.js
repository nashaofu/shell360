import fs from 'fs/promises';
import path from 'path';

const baseDir = path.join(import.meta.dirname, '../release');

async function main() {
  // refs/tags/v0.0.1
  const tagName = process.env.GITHUB_REF.replace('refs/tags/', '');

  // eslint-disable-next-line no-console
  console.log('tagName: ', tagName);

  // v0.0.1 => 0.0.1
  const version = tagName.slice(1);

  const updateData = {
    version,
    pub_date: new Date().toISOString(),
    platforms: {},
  };

  const platforms = {
    'windows-aarch64': {
      urlName: 'arm64-setup.exe',
      signatureName: 'arm64-setup.exe.sig',
    },
    'windows-x86': {
      urlName: 'x86-setup.exe',
      signatureName: 'x86-setup.exe.sig',
    },
    'windows-x86_64': {
      urlName: 'x64-setup.exe',
      signatureName: 'x64-setup.exe.sig',
    },
    'darwin-aarch64': {
      urlName: 'aarch64.app.tar.gz',
      signatureName: 'aarch64.app.tar.gz.sig',
    },
    'darwin-x86_64': {
      urlName: 'x64.app.tar.gz',
      signatureName: 'x64.app.tar.gz.sig',
    },
    'linux-x86_64': {
      urlName: 'amd64.AppImage',
      signatureName: 'amd64.AppImage.sig',
    },
  };

  const baseUrl = `https://github.com/shell360/release/releases/download/${tagName}/`;
  const files = await fs.readdir(baseDir);

  const tasks = Object.entries(platforms).map(
    async ([key, { urlName, signatureName }]) => {
      const urlFilename = files.find((item) => item.endsWith(urlName));
      const signatureFilename = files.find((item) =>
        item.endsWith(signatureName)
      );

      if (!urlFilename) {
        throw new Error(`Not found ${urlFilename}`);
      }
      if (!signatureFilename) {
        throw new Error(`Not found ${signatureFilename}`);
      }

      const signature = await fs.readFile(
        path.join(baseDir, signatureFilename),
        'utf8'
      );

      updateData.platforms[key] = {
        url: baseUrl + urlFilename,
        signature,
      };
    }
  );

  await Promise.all(tasks);

  const content = JSON.stringify(updateData, null, 2);

  // eslint-disable-next-line no-console
  console.log(content);

  fs.writeFile(path.join(baseDir, 'latest.json'), content);
}

main();
