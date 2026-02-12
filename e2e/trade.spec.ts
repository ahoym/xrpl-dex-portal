import {
  test,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";

// This project uses storageState: ".auth/wallet.json" (configured in playwright.config.ts)
// The global setup generates a testnet wallet with an RLUSD trust line.
// On testnet the default trading pair is RLUSD / XRP.

/**
 * The "Place Order" form section. Used to scope spinbutton selectors
 * (Amount and Price inputs) away from other numeric inputs on the page.
 */
function orderForm(page: Page) {
  return page.locator("div").filter({
    has: page.getByRole("heading", { name: "Place Order" }),
  });
}

test.describe.serial("Trade page", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      storageState: ".auth/wallet.json",
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("currency pair loads", async () => {
    await page.goto("/trade");

    // The "Order Book" heading should be visible once the pair is loaded
    await expect(
      page.getByRole("heading", { name: "Order Book" }),
    ).toBeVisible({ timeout: 15_000 });

    // The "Place Order" heading confirms the trade form rendered
    await expect(
      page.getByRole("heading", { name: "Place Order" }),
    ).toBeVisible();

    // Base and Quote comboboxes should have values selected.
    // On testnet the default pair is RLUSD / XRP.
    // Page has 5 comboboxes: network (nav), base, quote, depth (select), execution type.
    // Base is the 2nd combobox (index 1), Quote is the 3rd (index 2).
    const comboboxes = page.getByRole("combobox");

    // The Base selector should show RLUSD
    await expect(comboboxes.nth(1)).toContainText("RLUSD");

    // The Quote selector should show XRP
    await expect(comboboxes.nth(2)).toContainText("XRP");
  });

  test("place buy order", async () => {
    await page.goto("/trade");

    // Wait for the trade form to load
    await expect(
      page.getByRole("heading", { name: "Place Order" }),
    ).toBeVisible({ timeout: 15_000 });

    // The default pair on testnet is RLUSD/XRP — verify Buy tab is present
    const buyTab = page.getByRole("button", { name: /Buy RLUSD/ });
    await expect(buyTab).toBeVisible();

    // Click the Buy tab to ensure it is active
    await buyTab.click();

    // Fill in amount and price using scoped spinbuttons within the order form.
    // Amount is the 1st spinbutton, Price is the 2nd.
    const form = orderForm(page);
    const amountInput = form.getByRole("spinbutton").nth(0);
    const priceInput = form.getByRole("spinbutton").nth(1);

    await amountInput.fill("1");
    await priceInput.fill("0.000001");

    // Submit the order
    const submitButton = page.getByRole("button", { name: "Place Buy Order" });
    await expect(submitButton).toBeEnabled({ timeout: 5_000 });
    await submitButton.click();

    // Wait for the success message
    await expect(page.getByText("Order placed successfully!")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("cancel order", async () => {
    await page.goto("/trade");

    // Wait for the order book to load, confirming the pair is active
    await expect(
      page.getByRole("heading", { name: "Order Book" }),
    ).toBeVisible({ timeout: 15_000 });

    // The open order from the previous test should appear in the orders section.
    // On desktop, the OrdersSheet is a fixed bottom bar that starts collapsed.
    // Try to expand it by clicking the expand button (aria-label="Expand orders").
    const expandButton = page.getByRole("button", {
      name: "Expand orders",
    });
    if (
      await expandButton
        .isVisible({ timeout: 3_000 })
        .catch(() => false)
    ) {
      await expandButton.click();
    }

    // Wait for a Cancel button to appear (from the open order we placed)
    const cancelButton = page
      .getByRole("button", { name: "Cancel" })
      .first();
    await expect(cancelButton).toBeVisible({ timeout: 15_000 });

    // Click cancel
    await cancelButton.click();

    // The button should change to "Cancelling..." then the row should disappear.
    // Wait for the cancel button to be hidden (order removed from the table).
    await expect(cancelButton).toBeHidden({ timeout: 30_000 });
  });

  test("order book click prefill", async () => {
    await page.goto("/trade");

    // Wait for the order book to render
    await expect(
      page.getByRole("heading", { name: "Order Book" }),
    ).toBeVisible({ timeout: 15_000 });

    // Clickable order book rows have role="button".
    // These are ask or bid rows from other accounts (not the wallet's own orders).
    // Filter to rows that contain price-like numeric text.
    const orderBookRows = page.locator('[role="button"]').filter({
      hasText: /\d+\.\d{4,}/,
    });

    // Wait for clickable order book rows to appear. The component renders
    // "No asks"/"No bids" both while loading AND when empty, so we can't use
    // those as a "loaded" signal. Instead, give the data time to arrive.
    try {
      await orderBookRows.first().waitFor({ timeout: 15_000 });
    } catch {
      // Timed out — take a debug screenshot then skip.
      await page.screenshot({ path: "test-results/orderbook-prefill-debug.png", fullPage: true });
      test.skip(true, "No clickable order book rows available");
      return;
    }

    // Click the first clickable order book row
    await orderBookRows.first().click();

    // The trade form's price and amount inputs should now be populated
    // by the prefill callback (onSelectOrder sets price, amount, and tab).
    const form = orderForm(page);
    const priceInput = form.getByRole("spinbutton").nth(1);
    const amountInput = form.getByRole("spinbutton").nth(0);

    await expect(priceInput).not.toHaveValue("");
    await expect(amountInput).not.toHaveValue("");
  });
});
