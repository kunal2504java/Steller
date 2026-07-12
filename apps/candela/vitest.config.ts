import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      // `server-only` is never an installed package in this repo — Next.js
      // resolves the bare specifier itself, internally, only inside its own
      // webpack/turbopack build (see test/stubs/server-only.ts for detail).
      // Vitest runs on plain Vite, which fails to *resolve* the specifier
      // at all — `vi.mock("server-only", ...)` alone cannot rescue this,
      // because Vite's import-analysis plugin resolves import specifiers
      // eagerly during transform, before Vitest's mock substitution applies.
      // Aliasing to a real (empty) local file fixes resolution; source
      // files can then `import "server-only"` unmodified.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
});
