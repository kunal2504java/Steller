import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Resolve paths from THIS file so `pnpm vite --config playground/vite.config.ts`
// works no matter the cwd Playwright's webServer launches it from.
const require = createRequire(import.meta.url);
const here = fileURLToPath(new URL(".", import.meta.url)); // packages/candela-kit/playground
const pkgRoot = fileURLToPath(new URL("..", import.meta.url)); // packages/candela-kit

// passkey-kit / stellar-sdk (pulled in via ../src) lean on a browser
// `Buffer`/`global`; alias the Node `buffer` builtin to the npm polyfill so it
// isn't externalized (same treatment the spike's vite config needed).
export default defineConfig({
  root: here,
  envDir: pkgRoot, // load .env from the package root (VITE_CONTRACT_ID, VITE_FALLBACK_SECRET)
  plugins: [react()],
  define: { global: "globalThis" },
  resolve: {
    alias: {
      buffer: require.resolve("buffer"),
    },
  },
  optimizeDeps: {
    include: ["buffer"],
    esbuildOptions: { target: "es2022" },
  },
  server: { port: 5174 },
});
