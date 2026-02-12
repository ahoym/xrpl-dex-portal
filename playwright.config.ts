import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "setup",
      testMatch: "global-setup.ts",
    },
    {
      name: "setup-page",
      testMatch: "setup.spec.ts",
    },
    {
      name: "trade-page",
      testMatch: "trade.spec.ts",
      dependencies: ["setup"],
      use: { storageState: ".auth/wallet.json" },
    },
    {
      name: "transact-page",
      testMatch: "transact.spec.ts",
      dependencies: ["setup"],
      use: { storageState: ".auth/wallet.json" },
    },
  ],
});
