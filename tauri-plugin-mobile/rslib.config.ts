import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: './ts/**/*.ts',
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
});
