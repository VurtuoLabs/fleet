import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import salesforce from "@salesforce/vite-plugin-ui-bundle";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Relative asset URLs. The bundle is served from /app/c__fleetUi, not the domain root.
  base: "./",
  // The salesforce() plugin is REQUIRED. It consumes ui-bundle.json and emits the
  // artifacts the UI Bundle host expects. Without it the metadata deploys cleanly
  // and the app renders an empty shell. It also pins the project to Vite 7.
  plugins: [react(), salesforce()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // Sourcemaps ship inside the UIBundle and count toward its 2,500-file limit.
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
