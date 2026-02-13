import type { BalanceEntry } from "@/lib/types";
import type { CurrencyOption } from "./use-trading-data";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import type { NetworkId } from "@/lib/xrpl/networks";

/**
 * Build a deduplicated list of currency options from XRP + well-known
 * currencies + user balances + custom currencies.
 *
 * Extracted from the `useMemo` in `useTradingData` (lines 72-115) so the
 * logic can be tested without rendering a React component.
 */
export function buildCurrencyOptions(
  balances: BalanceEntry[],
  customCurrencies: { currency: string; issuer: string }[],
  network: NetworkId,
): CurrencyOption[] {
  const opts: CurrencyOption[] = [];
  const seen = new Set<string>();

  const xrpKey = `${Assets.XRP}|`;
  opts.push({ currency: Assets.XRP, label: Assets.XRP, value: xrpKey });
  seen.add(xrpKey);

  for (const [currency, issuer] of Object.entries(WELL_KNOWN_CURRENCIES[network] ?? {})) {
    const key = `${currency}|${issuer}`;
    if (!seen.has(key)) {
      seen.add(key);
      opts.push({ currency, issuer, label: `${currency} (${issuer})`, value: key });
    }
  }

  for (const b of balances) {
    const cur = decodeCurrency(b.currency);
    if (cur === Assets.XRP) continue;
    const key = `${cur}|${b.issuer ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    opts.push({
      currency: cur,
      issuer: b.issuer,
      label: b.issuer ? `${cur} (${b.issuer})` : cur,
      value: key,
    });
  }

  for (const c of customCurrencies) {
    const key = `${c.currency}|${c.issuer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    opts.push({
      currency: c.currency,
      issuer: c.issuer,
      label: `${c.currency} (${c.issuer})`,
      value: key,
    });
  }

  return opts;
}

/**
 * Result of trade detection: whether a refresh is needed, and the updated
 * set of seen hashes.
 */
export interface TradeDetectionResult {
  shouldRefresh: boolean;
}

/**
 * Detect new trades matching the user's address and determine whether a
 * refresh of account offers is needed.
 *
 * Extracted from the `useEffect` in `useTradingData` (lines 220-241).
 *
 * @param recentTrades - The current list of recent trades
 * @param seenHashes - Mutable set of already-seen trade hashes (mutated in place)
 * @param address - The user's wallet address (or undefined if not connected)
 * @returns Whether the caller should trigger a refresh
 */
export function detectNewOwnTrades(
  recentTrades: { hash: string; account: string }[],
  seenHashes: Set<string>,
  address: string | undefined,
): TradeDetectionResult {
  if (!address || recentTrades.length === 0) {
    return { shouldRefresh: false };
  }

  // On first load, seed the set without triggering a refresh
  if (seenHashes.size === 0) {
    for (const t of recentTrades) seenHashes.add(t.hash);
    return { shouldRefresh: false };
  }

  let hasNewOwnTrade = false;
  for (const t of recentTrades) {
    if (!seenHashes.has(t.hash)) {
      seenHashes.add(t.hash);
      if (t.account === address) hasNewOwnTrade = true;
    }
  }

  return { shouldRefresh: hasNewOwnTrade };
}
