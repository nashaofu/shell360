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
  },
  server: {
    host: '0.0.0.0',
    port: 1420,
    strictPort: true,
  },
});
