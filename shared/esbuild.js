import fs from 'fs';
import path from 'path';

import esbuild from 'esbuild';
import { lessLoader } from 'esbuild-plugin-less';
const pkg = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
);

const options = {
  entryPoints: ['./src/index.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  loader: {
    '.ts': 'ts',
    '.ttf': 'copy',
    '.woff': 'copy',
    '.woff2': 'copy',
  },
  plugins: [lessLoader()],
  external: [
    'react/jsx-runtime',
    '@xterm/xterm/css/xterm.css',
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
};

if (process.argv.includes('-w')) {
  const ctx = await esbuild.context(options);
  ctx.watch();
} else {
  esbuild.build(options);
}
