import { defineConfig } from "@playwright/test";

// Live-testnet regression: a full passkey -> smart-wallet -> sponsored
// register_issuer round trip runs on-chain, so the per-test timeout must exceed
// Playwright's 30s default (the spec waits up to 90s on each on-chain step).
// Values mirror the proven spike config (packages/spike/playwright.config.ts).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "pnpm vite --config playground/vite.config.ts",
    port: 5174,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:5174" },
});
