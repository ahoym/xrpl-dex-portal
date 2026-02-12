import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { selectCustomOption } from "./helpers/custom-select";

test.describe.serial("Setup page", () => {
  let context: BrowserContext;
  let page: Page;
  let walletAddress: string;
  let walletSeed: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/setup");

    // Switch to testnet
    const networkCombobox = page.locator("#network");
    await selectCustomOption(page, networkCombobox, "Testnet");

    // Generate wallet and wait for the address link to appear
    await page.getByRole("button", { name: /Generate Wallet/ }).click();
    const addressLink = page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ });
    await expect(addressLink).toBeVisible({ timeout: 30_000 });
    walletAddress = (await addressLink.textContent())!.trim();

    // Wait for XRP balance to show up (faucet funding)
    await expect(page.getByText(/^\d[\d,.]*\s*XRP$/)).toBeVisible({ timeout: 15_000 });

    // Reveal the seed so we can capture it for the import test
    await page.getByRole("button", { name: "Show secret" }).click();
    const seedEl = page.locator("text=/^s[a-zA-Z0-9]{20,}/");
    await expect(seedEl).toBeVisible();
    walletSeed = (await seedEl.textContent())!.trim();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("generate wallet — address visible, XRP balance shown, Fund from Faucet button visible", async () => {
    // Wallet was generated in beforeAll — verify state on the shared page
    await expect(page.getByRole("link", { name: walletAddress })).toBeVisible();

    // XRP balance badge should be visible
    await expect(page.getByText(/^\d[\d,.]*\s*XRP$/)).toBeVisible();

    // "Fund from Faucet" button should be visible on testnet
    await expect(
      page.getByRole("button", { name: /Fund from Faucet/ }),
    ).toBeVisible();
  });

  test("import from seed — reveal seed, remove wallet, paste seed, import, assert same address", async () => {
    // Navigate fresh to /setup (still same context with localStorage)
    await page.goto("/setup");
    const networkCombobox = page.locator("#network");
    await selectCustomOption(page, networkCombobox, "Testnet");

    // Wait for the wallet to be loaded from localStorage
    await expect(page.getByRole("link", { name: walletAddress })).toBeVisible({ timeout: 15_000 });

    // Reveal the seed
    await page.getByRole("button", { name: "Show secret" }).click();
    const revealedSeed = page.locator("text=/^s[a-zA-Z0-9]{20,}/");
    await expect(revealedSeed).toBeVisible();
    const seedText = (await revealedSeed.textContent())!.trim();
    expect(seedText).toBe(walletSeed);

    // Remove the wallet — accept the confirm dialog
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Remove Wallet/ }).click();

    // After removal, "Generate Wallet" should reappear
    await expect(
      page.getByRole("button", { name: /Generate Wallet/ }),
    ).toBeVisible({ timeout: 10_000 });

    // Import from seed — fill the import input and click Import
    const seedInput = page.getByPlaceholder("sXXXXXXXX...");
    await seedInput.fill(walletSeed);
    await page.getByRole("button", { name: "Import", exact: true }).click();

    // Assert the same address reappears
    await expect(page.getByRole("link", { name: walletAddress })).toBeVisible({ timeout: 10_000 });
  });

  test("quick trust line — click Trust RLUSD, assert becomes RLUSD (trusted) and is disabled", async () => {
    await page.goto("/setup");
    const networkCombobox = page.locator("#network");
    await selectCustomOption(page, networkCombobox, "Testnet");

    // Wait for wallet and balance to load (need >= 2 XRP for trust lines)
    await expect(page.getByRole("link", { name: walletAddress })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^\d[\d,.]*\s*XRP$/)).toBeVisible({ timeout: 15_000 });

    // Click the "Trust RLUSD" quick trust button
    const trustButton = page.getByRole("button", { name: /Trust RLUSD/ });
    await expect(trustButton).toBeVisible({ timeout: 10_000 });
    await trustButton.click();

    // Wait for the button to transition to "RLUSD (trusted)" and become disabled
    const trustedButton = page.getByRole("button", {
      name: /RLUSD \(trusted\)/,
    });
    await expect(trustedButton).toBeVisible({ timeout: 20_000 });
    await expect(trustedButton).toBeDisabled();
  });

  test("data export/clear — click View JSON, assert JSON contains address, clear all data, assert Generate Wallet reappears", async () => {
    await page.goto("/setup");
    const networkCombobox = page.locator("#network");
    await selectCustomOption(page, networkCombobox, "Testnet");

    // Wait for wallet to load
    await expect(page.getByRole("link", { name: walletAddress })).toBeVisible({ timeout: 15_000 });

    // Click "View JSON" to expand the inline JSON display
    await page.getByRole("button", { name: "View JSON" }).click();

    // Assert the JSON <pre> block is visible and contains the wallet address
    const jsonPre = page.locator("pre");
    await expect(jsonPre).toBeVisible();
    const jsonText = await jsonPre.textContent();
    expect(jsonText).toContain(walletAddress);

    // Click "Clear All Data" — accept the confirm dialog
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Clear All Data" }).click();

    // After clearing, "Generate Wallet" should reappear
    await expect(
      page.getByRole("button", { name: /Generate Wallet/ }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
