import { defineConfig } from "vite";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// passkey-kit (and passkey-kit-sdk / sac-sdk) ship raw TypeScript and lean on a
// browser `Buffer`/`global`. Vite transpiles the TS deps via esbuild; we alias
// the Node `buffer` builtin to the npm polyfill so it isn't externalized.
export default defineConfig({
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: require.resolve("buffer"),
    },
  },
  optimizeDeps: {
    include: ["buffer"],
    esbuildOptions: { target: "es2022" },
  },
  server: { port: 5173 },
});
