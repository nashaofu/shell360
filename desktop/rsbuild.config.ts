import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginLess } from '@rsbuild/plugin-less';

export default defineConfig({
  plugins: [pluginReact(), pluginLess()],
  source: {
    define: {
      'import.meta.env.TAURI_PLATFORM': JSON.stringify(
        process.env.TAURI_ENV_PLATFORM
      ),
    },
  },
  html: {
    template: './index.html',
    templateParameters: {
      TAURI_PLATFORM: process.env.TAURI_ENV_PLATFORM,
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
});
