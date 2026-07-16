import { createRequire } from "node:module";
import { defineConfig } from "tsup";

const require = createRequire(import.meta.url);
const browserBuffer = require.resolve("buffer/");

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "browser",
  dts: true,
  sourcemap: true,
  clean: true,
  external: [/^react(?:\/.*)?$/, /^react-dom(?:\/.*)?$/],
  // passkey-kit@0.11.3 and its generated contract clients publish raw TS.
  // Bundle the pinned runtime graph so Next/browser consumers do not need to
  // understand those packages' source layout or Stellar's Node-only exports.
  noExternal: [/^(?!react(?:-dom)?(?:\/|$)).*/],
  esbuildPlugins: [{
    name: "browser-buffer",
    setup(build) {
      build.onResolve({ filter: /^buffer$/ }, () => ({ path: browserBuffer }));
    },
  }, {
    name: "stellar-sdk-minimal-package-metadata",
    setup(build) {
      const namespace = "stellar-sdk-package-metadata";
      build.onResolve({ filter: /^\.\.\/\.\.\/package\.json$/ }, (args) => {
        const importer = args.importer.replaceAll("\\", "/");
        if (!importer.endsWith("/@stellar/stellar-sdk/lib/minimal/bindings/config.js")) return;
        // stellar-sdk@14.6.1's files list omits lib/package.json even though
        // its generated ConfigGenerator imports it for the SDK version.
        return { path: "package.json", namespace };
      });
      build.onLoad({ filter: /.*/, namespace }, () => ({
        contents: JSON.stringify({ version: "14.6.1" }),
        loader: "json",
      }));
    },
  }],
});
