import { pluginReact } from '@rsbuild/plugin-react';
import { pluginLess } from '@rsbuild/plugin-less';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/**/*.{ts,tsx,less,css}',
    },
  },
  lib: [
    {
      bundle: false,
      dts: true,
      format: 'esm',
    },
  ],
  output: {
    target: 'web',
  },
  plugins: [pluginReact(), pluginLess()],
});
