import {
  test,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";

// This project uses storageState: ".auth/wallet.json" (configured in playwright.config.ts)

test.describe("Transact page", () => {
  test("page loads", async ({ page }) => {
    await page.goto("/transact");

    // Assert "Transact" heading visible
    await expect(
      page.getByRole("heading", { name: "Transact", level: 1 }),
    ).toBeVisible();

    // Assert wallet address visible (rendered as a link by ExplorerLink)
    await expect(
      page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ }),
    ).toBeVisible();

    // Assert "Send" button visible
    await expect(
      page.getByRole("button", { name: "Send" }),
    ).toBeVisible();
  });

  test.describe.serial("contacts", () => {
    // Shared context so contacts persist in localStorage across serial tests
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

    test("add contact", async () => {
      await page.goto("/transact");

      // Click "+ Add Contact" to open the contact form
      await page.getByRole("button", { name: "+ Add Contact" }).click();

      // Fill in Label (uses placeholder-based input, not <label> element)
      await page
        .getByPlaceholder("e.g. Exchange Hot Wallet")
        .fill("Test Contact");

      // Fill in Address
      await page
        .getByPlaceholder("rXXXXXXXX...")
        .fill("rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe");

      // Fill in Destination Tag
      await page.getByRole("spinbutton").fill("12345");

      // Click "Add" to save
      await page.getByRole("button", { name: "Add", exact: true }).click();

      // Assert contact appears in the list
      await expect(page.getByText("Test Contact")).toBeVisible();
      await expect(
        page.getByText("rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"),
      ).toBeVisible();
      await expect(page.getByText("Tag: 12345")).toBeVisible();
    });

    test("edit contact", async () => {
      await page.goto("/transact");

      // Contact persisted from previous test in localStorage
      await expect(page.getByText("Test Contact")).toBeVisible();

      // Click "Edit" on the contact
      await page.getByRole("button", { name: "Edit" }).click();

      // Change label to "Updated Contact"
      const labelInput = page.getByPlaceholder("e.g. Exchange Hot Wallet");
      await labelInput.clear();
      await labelInput.fill("Updated Contact");

      // Click "Update" to save
      await page.getByRole("button", { name: "Update" }).click();

      // Assert updated label appears
      await expect(page.getByText("Updated Contact")).toBeVisible();
    });

    test("delete contact", async () => {
      await page.goto("/transact");

      // Contact persisted from previous test in localStorage
      await expect(page.getByText("Updated Contact")).toBeVisible();

      // Set up dialog handler BEFORE clicking remove
      page.on("dialog", (d) => d.accept());

      // Click "Remove" button
      await page.getByRole("button", { name: "Remove" }).click();

      // Assert contact is removed from list
      await expect(page.getByText("Updated Contact")).not.toBeVisible();
      await expect(
        page.getByText(
          "No contacts yet. Add a contact to quickly send funds.",
        ),
      ).toBeVisible();
    });
  });

  test("send XRP", async ({ page }) => {
    await page.goto("/transact");

    // Wait for balances to load so the currency select is populated
    await expect(page.getByText(/^\d[\d,.]*\s*XRP$/)).toBeVisible({
      timeout: 15_000,
    });

    // Click "Send" button to open the send modal
    await page.getByRole("button", { name: "Send" }).click();

    // Assert the modal title is visible
    await expect(
      page.getByRole("heading", { name: "Send Currency" }),
    ).toBeVisible();

    // Scope subsequent selectors to the modal form
    const modal = page.locator("form");

    // XRP should be selected by default in the Currency combobox (inside modal)
    await expect(modal.getByRole("combobox")).toContainText("XRP");

    // Fill amount
    await modal.getByRole("spinbutton").first().fill("0.1");

    // Click "Other" to send to an ad-hoc address instead of a contact
    await modal.getByRole("button", { name: "Other" }).click();

    // Enter recipient address
    await page
      .getByPlaceholder("rXXXXXXXX...")
      .fill("rfh837S6GLYasyHmaMDhiVvBajBQDzxSap");

    // Click "Send" to submit the form (the submit button inside the modal)
    await modal.getByRole("button", { name: "Send" }).click();

    // Assert "Transfer successful!" message appears
    await expect(page.getByText("Transfer successful!")).toBeVisible({
      timeout: 30_000,
    });
  });
});
