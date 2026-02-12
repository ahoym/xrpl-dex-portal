# Playwright E2E Testing Patterns

Patterns, gotchas, and best practices discovered while writing Playwright end-to-end tests for the XRPL DEX Portal.

---

## 1. Shared BrowserContext for Serial Tests

**Utility: High**

When using `test.describe.serial()` in Playwright, each test gets its own `BrowserContext` by default (via the `{ page }` fixture). This means **localStorage is NOT shared** between serial tests. To share state (e.g., a generated wallet stored in localStorage), create a shared `BrowserContext` and `Page` in `beforeAll`, and have test callbacks use `async ()` (no fixture destructuring) so they reference the closure variables.

```ts
test.describe.serial("Feature", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: ".auth/wallet.json" });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("step 1", async () => {
    /* use closure `page` — localStorage persists */
  });

  test("step 2", async () => {
    /* same page and context, localStorage carries over */
  });
});
```

**Key takeaway:** If you destructure `{ page }` from the test fixture in a serial block, each test gets a fresh context and localStorage is wiped. Use closure variables instead.

---

## 2. page.once vs page.on for Dialog Handlers on Shared Pages

**Utility: High**

When reusing a `Page` instance across serial tests, using `page.on("dialog", handler)` **stacks handlers** — each test adds another listener. When a dialog fires, multiple handlers try to accept it, causing:

```
Cannot accept dialog which is already handled!
```

**Fix:** Use `page.once("dialog", handler)` for one-time dialog handling. This automatically removes the handler after a single invocation, preventing stacking across tests.

```ts
// Bad — stacks handlers across serial tests
page.on("dialog", (d) => d.accept());

// Good — one-time handler, no stacking
page.once("dialog", (d) => d.accept());
```

---

## 3. getByRole Uses Accessible Name (aria-label) Over Visible Text

**Utility: Medium**

Playwright's `getByRole("button", { name: "..." })` matches the **accessible name**, which prioritizes `aria-label` over visible text content. A button with `aria-label="Expand orders"` and inner text "Show Orders" will **NOT** match `{ name: "Show Orders" }`.

```html
<button aria-label="Expand orders">Show Orders</button>
```

```ts
// Fails — "Show Orders" is the visible text, not the accessible name
await page.getByRole("button", { name: "Show Orders" }).click();

// Works — matches the aria-label
await page.getByRole("button", { name: "Expand orders" }).click();
```

**Tip:** Use the Playwright Inspector or `page.getByRole("button").all()` to debug which names Playwright sees for each element.

---

## 4. Nav Bar textContent Concatenation Causes False Regex Matches

**Utility: High**

`textContent` on container elements concatenates all child text **without separators**. A nav bar with links "Trade", "Transact", "Explorer", "Testnet" produces the string:

```
TradeTransactExplorerTestnet
```

The substring `radeTransactExplorerTestnet` (27 characters starting with "r") matches `/r[a-zA-Z0-9]{24,}/` — a regex intended for XRPL addresses (which start with "r" followed by 24+ alphanumeric chars). This causes **strict mode violations** when using `getByText()` with address-like patterns.

**Fix:** Use role-based selectors that target specific elements rather than searching all text content:

```ts
// Bad — matches concatenated nav text
await page.getByText(/r[a-zA-Z0-9]{24,}/).click();

// Good — targets a specific link element
await page.getByRole("link", { name: /^r[a-zA-Z0-9]{24,}/ }).click();
```

---

## 5. Scope Selectors to Containers to Avoid Strict Mode Violations

**Utility: Medium**

When a page has duplicate interactive elements (e.g., a network selector in the nav bar AND a currency selector in a modal), unscoped selectors like `page.getByRole("combobox").first()` may resolve to the wrong element or cause strict mode errors if multiple matches exist.

**Fix:** Scope selectors to a parent container using `.locator()`:

```ts
// Bad — may match nav bar combobox instead of modal combobox
await page.getByRole("combobox").first().click();

// Good — scoped to the form/modal container
const modal = page.locator("form");
await modal.getByRole("combobox").first().click();
```

This pattern is especially important in the XRPL DEX Portal where the nav bar contains a network selector dropdown that could conflict with other selectors on the page.
