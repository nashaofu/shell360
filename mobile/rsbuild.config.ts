import { defineConfig } from "@rsbuild/core";
import { pluginLess } from "@rsbuild/plugin-less";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginSvgr } from "@rsbuild/plugin-svgr";

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginLess(),
    pluginSvgr({
      svgrOptions: {
        exportType: "named",
      },
      mixedImport: true,
    }),
  ],
  source: {
    define: {
      "import.meta.env.ENV_PLATFORM": JSON.stringify(process.env.ENV_PLATFORM),
    },
  },
  html: {
    template: "./index.html",
    templateParameters: {
      ENV_PLATFORM: process.env.ENV_PLATFORM,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 1421,
    strictPort: true,
  },
});
