import { defineConfig } from "@rsbuild/core";
import { pluginLess } from "@rsbuild/plugin-less";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact(), pluginLess()],
  source: {
    define: {
      "import.meta.env.TAURI_ENV_PLATFORM": JSON.stringify(
        process.env.TAURI_ENV_PLATFORM,
      ),
    },
  },
  html: {
    template: "./index.html",
    templateParameters: {
      TAURI_ENV_PLATFORM: process.env.TAURI_ENV_PLATFORM,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
});
