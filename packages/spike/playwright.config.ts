import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "pnpm dev",
    port: 5173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:5173" },
});
