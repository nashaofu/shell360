import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { execa } from "execa";

const workspaceDir = url.fileURLToPath(new URL("../", import.meta.url));
const sourcePath = path.join(workspaceDir, "resources/icon.svg");
const sourceSvg = await fs.readFile(sourcePath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shell360-icons-"));
const tauriCliPath = path.join(
  workspaceDir,
  "node_modules/@tauri-apps/cli/tauri.js",
);

async function renderSvg(
  svg: string,
  outputDir: string,
  pngSizes?: number[],
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  const inputPath = path.join(outputDir, "icon.svg");
  await fs.writeFile(inputPath, svg);

  const args = [tauriCliPath, "icon", inputPath, "--output", outputDir];
  if (pngSizes) args.push("--png", pngSizes.join(","));

  await execa(process.execPath, args, { stdio: "inherit" });
}

async function copyGenerated(
  sourceDir: string,
  sourceName: string,
  destination: string,
): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(sourceDir, sourceName), destination);
}

function makeIco(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + pngs.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = header.length;
  pngs.forEach(({ size, data }, index) => {
    const entryOffset = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entryOffset);
    header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(data.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += data.length;
  });

  return Buffer.concat([header, ...pngs.map(({ data }) => data)]);
}

const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><g transform="translate(19.2 19.2) scale(0.85)"><path d="M128 40L202 83V169L128 212L54 169V83L128 40Z" fill="#171E35" stroke="#2EC7DB" stroke-width="8" stroke-linejoin="round"/><path d="M125 115.5L82 90V106L109 122L82 138V154L125 128.5Z" fill="#F5F7FF"/><path d="M139 151H173" fill="none" stroke="#F5F7FF" stroke-width="16" stroke-linecap="square"/></g></svg>`;

const tintedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#171E35"/><path d="M128 40L202 83V169L128 212L54 169V83L128 40Z" fill="none" stroke="#F5F7FF" stroke-width="8" stroke-linejoin="round"/><path d="M125 115.5L82 90V106L109 122L82 138V154L125 128.5Z" fill="#F5F7FF"/><path d="M139 151H173" fill="none" stroke="#F5F7FF" stroke-width="16" stroke-linecap="square"/></svg>`;

try {
  const squareSvg = sourceSvg.replace('rx="56"', 'rx="0"');
  const windowsCornerRadius = ((6 / 48) * 256).toString();
  const windowsSvg = sourceSvg.replace(
    'rx="56"',
    `rx="${windowsCornerRadius}"`,
  );
  const darkSvg = squareSvg
    .replaceAll("#171E35", "#0D1225")
    .replaceAll("#2EC7DB", "#60DDEA");
  const faviconDir = path.join(tempDir, "favicon");
  const defaultDir = path.join(tempDir, "default");
  const windowsDir = path.join(tempDir, "windows");
  const darkDir = path.join(tempDir, "dark");
  const tintedDir = path.join(tempDir, "tinted");
  const harmonyForegroundDir = path.join(tempDir, "harmony-foreground");
  const harmonyBackgroundDir = path.join(tempDir, "harmony-background");
  const startIconDir = path.join(tempDir, "start-icon");

  await Promise.all([
    renderSvg(squareSvg, defaultDir),
    renderSvg(windowsSvg, windowsDir),
    renderSvg(sourceSvg, faviconDir, [16, 32, 48, 64]),
    renderSvg(darkSvg, darkDir, [1024]),
    renderSvg(tintedSvg, tintedDir, [1024]),
    renderSvg(foregroundSvg, harmonyForegroundDir, [1024]),
    renderSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#171E35"/></svg>',
      harmonyBackgroundDir,
      [1024],
    ),
    renderSvg(squareSvg, startIconDir, [256]),
  ]);

  const tauriIconsDir = path.join(workspaceDir, "src-tauri/icons");
  const windowsIconFiles = new Set([
    "StoreLogo.png",
    "Square30x30Logo.png",
    "Square44x44Logo.png",
    "Square71x71Logo.png",
    "Square89x89Logo.png",
    "Square107x107Logo.png",
    "Square142x142Logo.png",
    "Square150x150Logo.png",
    "Square284x284Logo.png",
    "Square310x310Logo.png",
    "icon.ico",
  ]);
  for (const filename of [
    "StoreLogo.png",
    "Square30x30Logo.png",
    "Square44x44Logo.png",
    "Square71x71Logo.png",
    "Square89x89Logo.png",
    "Square107x107Logo.png",
    "Square142x142Logo.png",
    "Square150x150Logo.png",
    "Square284x284Logo.png",
    "Square310x310Logo.png",
    "32x32.png",
    "128x128.png",
    "128x128@2x.png",
    "icon.png",
    "icon.icns",
    "icon.ico",
  ]) {
    const sourceDir = windowsIconFiles.has(filename) ? windowsDir : defaultDir;
    await copyGenerated(
      sourceDir,
      filename,
      path.join(tauriIconsDir, filename),
    );
  }

  await copyGenerated(
    defaultDir,
    "icon.png",
    path.join(workspaceDir, "resources/icon.png"),
  );

  for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
    for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
      await copyGenerated(
        path.join(defaultDir, "android", `mipmap-${density}`),
        name,
        path.join(
          workspaceDir,
          "android/app/src/main/res",
          `mipmap-${density}`,
          name,
        ),
      );
    }
  }

  const androidForeground = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="256" android:viewportHeight="256">
    <group android:pivotX="128" android:pivotY="128" android:scaleX="0.85" android:scaleY="0.85">
        <path android:fillColor="@color/launcher_background" android:strokeColor="@color/launcher_accent" android:strokeWidth="8" android:strokeLineJoin="round" android:pathData="M128,40L202,83L202,169L128,212L54,169L54,83Z" />
        <path android:fillColor="@color/launcher_foreground" android:pathData="M125,115.5L82,90L82,106L109,122L82,138L82,154L125,128.5Z" />
        <path android:fillColor="#00000000" android:strokeColor="@color/launcher_foreground" android:strokeWidth="16" android:strokeLineCap="square" android:pathData="M139,151L173,151" />
    </group>
</vector>
`;
  const androidMonochrome = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="256" android:viewportHeight="256">
    <group android:pivotX="128" android:pivotY="128" android:scaleX="0.85" android:scaleY="0.85">
        <path android:fillColor="#00000000" android:strokeColor="#FFFFFFFF" android:strokeWidth="8" android:strokeLineJoin="round" android:pathData="M128,40L202,83L202,169L128,212L54,169L54,83Z" />
        <path android:fillColor="#FFFFFFFF" android:pathData="M125,115.5L82,90L82,106L109,122L82,138L82,154L125,128.5Z" />
        <path android:fillColor="#00000000" android:strokeColor="#FFFFFFFF" android:strokeWidth="16" android:strokeLineCap="square" android:pathData="M139,151L173,151" />
    </group>
</vector>
`;
  await fs.writeFile(
    path.join(
      workspaceDir,
      "android/app/src/main/res/drawable/ic_launcher_foreground.xml",
    ),
    androidForeground,
  );
  await fs.writeFile(
    path.join(
      workspaceDir,
      "android/app/src/main/res/drawable/ic_launcher_monochrome.xml",
    ),
    androidMonochrome,
  );

  const faviconPngs = await Promise.all(
    [16, 32, 48, 64].map(async (size) => ({
      size,
      data: await fs.readFile(path.join(faviconDir, `${size}x${size}.png`)),
    })),
  );
  const favicon = makeIco(faviconPngs);
  for (const filename of [
    "desktop/public/favicon.ico",
    "mobile/public/favicon.ico",
  ]) {
    await fs.writeFile(path.join(workspaceDir, filename), favicon);
  }

  await fs.copyFile(
    sourcePath,
    path.join(workspaceDir, "desktop/src/assets/logo.svg"),
  );
  await fs.copyFile(
    sourcePath,
    path.join(workspaceDir, "mobile/src/routes/Root/Sidebar/logo.svg"),
  );

  const iosIconDir = path.join(
    workspaceDir,
    "ios/shell360/Assets.xcassets/AppIcon.appiconset",
  );
  await copyGenerated(
    defaultDir,
    "ios/AppIcon-512@2x.png",
    path.join(iosIconDir, "logo.png"),
  );
  await copyGenerated(
    darkDir,
    "1024x1024.png",
    path.join(iosIconDir, "logo-dark.png"),
  );
  await copyGenerated(
    tintedDir,
    "1024x1024.png",
    path.join(iosIconDir, "logo-tinted.png"),
  );

  const harmonyBaseDir = path.join(
    workspaceDir,
    "harmonyos/AppScope/resources/base/media",
  );
  const harmonyEntryDir = path.join(
    workspaceDir,
    "harmonyos/entry/src/main/resources/base/media",
  );
  for (const directory of [harmonyBaseDir, harmonyEntryDir]) {
    await copyGenerated(
      harmonyBackgroundDir,
      "1024x1024.png",
      path.join(directory, "background.png"),
    );
    await copyGenerated(
      harmonyForegroundDir,
      "1024x1024.png",
      path.join(directory, "foreground.png"),
    );
  }
  await copyGenerated(
    startIconDir,
    "256x256.png",
    path.join(harmonyEntryDir, "startIcon.png"),
  );

  console.log("Generated Shell360 app icons from resources/icon.svg");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
