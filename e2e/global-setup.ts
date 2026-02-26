import { test as setup, expect } from "@playwright/test";
import { selectCustomOption } from "./helpers/custom-select";

setup("generate wallet and trust RLUSD", async ({ page }) => {
  setup.setTimeout(120_000);

  // 1. Navigate to /setup
  await page.goto("/setup");

  // 2. Switch network to Testnet via #network CustomSelect
  const networkCombobox = page.locator("#network");
  await selectCustomOption(page, networkCombobox, "Testnet");

  // 3. Click "Generate Wallet", wait for address to appear (30s for faucet)
  await page.getByRole("button", { name: /Generate Wallet/ }).click();
  await expect(page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ })).toBeVisible({
    timeout: 30_000,
  });

  // 4. Wait for XRP balance to display
  await expect(page.getByText(/^\d[\d,.]*\s*XRP$/)).toBeVisible({ timeout: 15_000 });

  // 5. Click "Trust RLUSD", wait for button to show "RLUSD (trusted)"
  await page.getByRole("button", { name: /Trust RLUSD/ }).click();
  await expect(page.getByRole("button", { name: /RLUSD \(trusted\)/ })).toBeVisible({
    timeout: 20_000,
  });

  // 6. Save storageState for dependent projects
  await page.context().storageState({ path: ".auth/wallet.json" });
});
