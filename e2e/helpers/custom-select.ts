import { type Locator, type Page } from "@playwright/test";

/**
 * Interact with the app's CustomSelect combobox component.
 * Clicks the trigger, waits for the listbox, selects an option, waits for close.
 */
export async function selectCustomOption(
  page: Page,
  combobox: Locator,
  optionLabel: string,
): Promise<void> {
  await combobox.click();
  const listbox = page.getByRole("listbox");
  await listbox.waitFor({ state: "visible" });
  await listbox.getByRole("option", { name: optionLabel }).click();
  await listbox.waitFor({ state: "hidden" });
}
