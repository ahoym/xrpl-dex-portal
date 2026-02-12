import { Assets } from "@/lib/assets";
import { matchesCurrency } from "./match-currency";

export interface FilledOrder {
  side: "buy" | "sell";
  price: string;
  baseAmount: string;
  quoteAmount: string;
  time: string;
  hash: string;
}

interface BalanceChange {
  account: string;
  balances: { currency: string; value: string; issuer?: string }[];
}

/**
 * Minimal re-implementation of xrpl.js `getBalanceChanges` for client-side use.
 * Walks AffectedNodes in transaction metadata and computes per-account balance
 * deltas from modified/created/deleted AccountRoot and RippleState nodes.
 */
function getBalanceChangesClient(
  meta: Record<string, unknown>,
): BalanceChange[] {
  const nodes = (meta.AffectedNodes ?? []) as Record<string, unknown>[];
  const map = new Map<string, Map<string, { value: number; currency: string; issuer?: string }>>();

  function addDelta(account: string, currency: string, issuer: string | undefined, delta: number) {
    if (!map.has(account)) map.set(account, new Map());
    const key = `${currency}:${issuer ?? ""}`;
    const acctMap = map.get(account)!;
    const existing = acctMap.get(key);
    if (existing) {
      existing.value += delta;
    } else {
      acctMap.set(key, { value: delta, currency, issuer });
    }
  }

  for (const node of nodes) {
    const wrapper = (node.ModifiedNode ?? node.CreatedNode ?? node.DeletedNode) as Record<string, unknown> | undefined;
    if (!wrapper) continue;
    const entryType = wrapper.LedgerEntryType as string;

    if (entryType === "AccountRoot") {
      const prev = (wrapper.PreviousFields as Record<string, unknown>) ?? {};
      const final = (wrapper.FinalFields as Record<string, unknown>) ??
        (wrapper.NewFields as Record<string, unknown>) ?? {};

      const prevBalance = typeof prev.Balance === "string" ? parseInt(prev.Balance, 10) : undefined;
      const finalBalance = typeof final.Balance === "string" ? parseInt(final.Balance, 10) : undefined;

      if (prevBalance != null && finalBalance != null) {
        const account = final.Account as string;
        const delta = (finalBalance - prevBalance) / 1_000_000;
        if (delta !== 0 && account) {
          addDelta(account, Assets.XRP, undefined, delta);
        }
      } else if (prevBalance == null && finalBalance != null && node.CreatedNode) {
        const account = final.Account as string;
        if (account) addDelta(account, Assets.XRP, undefined, finalBalance / 1_000_000);
      }
    } else if (entryType === "RippleState") {
      const prev = (wrapper.PreviousFields as Record<string, unknown>) ?? {};
      const final = (wrapper.FinalFields as Record<string, unknown>) ??
        (wrapper.NewFields as Record<string, unknown>) ?? {};

      const prevBal = prev.Balance as Record<string, string> | undefined;
      const finalBal = final.Balance as Record<string, string> | undefined;

      if (finalBal) {
        const currency = finalBal.currency ?? "";
        const prevVal = prevBal ? parseFloat(prevBal.value) : 0;
        const finalVal = parseFloat(finalBal.value);
        const delta = finalVal - prevVal;

        const highAccount = (final.HighLimit as Record<string, string>)?.issuer;
        const lowAccount = (final.LowLimit as Record<string, string>)?.issuer;

        if (delta !== 0 && highAccount && lowAccount) {
          // Positive balance means low account holds the IOU (high is issuer)
          // So a positive delta means low gained, high lost
          addDelta(lowAccount, currency, highAccount, delta);
          addDelta(highAccount, currency, lowAccount, -delta);
        }
      }
    }
  }

  const result: BalanceChange[] = [];
  for (const [account, balances] of map) {
    const bals = Array.from(balances.values())
      .filter((b) => Math.abs(b.value) > 1e-12)
      .map((b) => ({
        currency: b.currency,
        value: b.value.toString(),
        ...(b.issuer ? { issuer: b.issuer } : {}),
      }));
    if (bals.length > 0) result.push({ account, balances: bals });
  }
  return result;
}

/**
 * Parse filled orders from raw account_tx response for a given currency pair.
 * Returns orders sorted newest-first.
 */
export function parseFilledOrders(
  transactions: Record<string, unknown>[],
  walletAddress: string,
  baseCurrency: string,
  baseIssuer: string | undefined,
  quoteCurrency: string,
  quoteIssuer: string | undefined,
): FilledOrder[] {
  const filled: FilledOrder[] = [];

  for (const entry of transactions) {
    const tx = entry.tx_json as Record<string, unknown> | undefined;
    const meta = entry.meta as Record<string, unknown> | undefined;
    if (!tx || !meta) continue;
    if (tx.TransactionType !== "OfferCreate") continue;
    if (typeof meta === "string") continue;
    if (meta.TransactionResult !== "tesSUCCESS") continue;
    // Only include the user's own transactions
    if (tx.Account !== walletAddress) continue;

    const changes = getBalanceChangesClient(meta);

    let baseDelta = 0;
    let quoteDelta = 0;

    for (const acctChanges of changes) {
      if (acctChanges.account !== walletAddress) continue;

      for (const bal of acctChanges.balances) {
        const val = parseFloat(bal.value);
        if (matchesCurrency(bal, baseCurrency, baseIssuer)) {
          baseDelta += val;
        } else if (matchesCurrency(bal, quoteCurrency, quoteIssuer)) {
          quoteDelta += val;
        }
      }
    }

    // A fill requires meaningful changes on both sides of the pair.
    // Skip fee-only XRP changes (< 0.001) and zero deltas.
    const baseAmount = Math.abs(baseDelta);
    const quoteAmount = Math.abs(quoteDelta);
    if (baseAmount < 0.001 || quoteAmount < 0.001) continue;

    // If user received base currency (positive delta), they bought
    const isBuy = baseDelta > 0;

    const time = (entry.close_time_iso as string) ?? (entry.date as string) ?? "";
    const hash = (entry.hash as string) ?? (tx.hash as string) ?? "";

    if (baseAmount > 0 && quoteAmount > 0) {
      const price = quoteAmount / baseAmount;
      filled.push({
        side: isBuy ? "buy" : "sell",
        price: price.toPrecision(6),
        baseAmount: baseAmount.toPrecision(6),
        quoteAmount: quoteAmount.toPrecision(6),
        time,
        hash,
      });
    } else if (baseAmount > 0 || quoteAmount > 0) {
      filled.push({
        side: isBuy ? "buy" : "sell",
        price: "—",
        baseAmount: baseAmount > 0 ? baseAmount.toPrecision(6) : "—",
        quoteAmount: quoteAmount > 0 ? quoteAmount.toPrecision(6) : "—",
        time,
        hash,
      });
    }
  }

  return filled;
}
