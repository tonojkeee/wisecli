import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const sharedAlias = { "@shared": resolve(__dirname, "src/shared") };

export default defineConfig({
  main: {
    // Don't externalize deps - bundle them into the output
    // This fixes the issue with missing packages in production
    resolve: {
      alias: sharedAlias,
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
        external: [
          // Only externalize native modules that can't be bundled
          "node-pty",
          "electron",
          // Optional peer dependencies of ws - externalized to allow graceful fallback
          "bufferutil",
          "utf-8-validate",
        ],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sharedAlias,
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer"),
        ...sharedAlias,
      },
    },
    publicDir: resolve(__dirname, "public"),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
        },
      },
      target: "esnext",
    },
    optimizeDeps: {
      include: ["monaco-editor"],
      esbuildOptions: {
        target: "esnext",
      },
    },
  },
});
