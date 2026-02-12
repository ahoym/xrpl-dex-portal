import { getBalanceChanges } from "xrpl";
import type { TransactionMetadata } from "xrpl";
import BigNumber from "bignumber.js";
import { matchesCurrency } from "./match-currency";

export interface FilledOrder {
  side: "buy" | "sell";
  price: string;
  baseAmount: string;
  quoteAmount: string;
  time: string;
  hash: string;
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
    const meta = entry.meta as TransactionMetadata | string | undefined;
    if (!tx || !meta) continue;
    if (tx.TransactionType !== "OfferCreate") continue;
    if (typeof meta === "string") continue;
    if (meta.TransactionResult !== "tesSUCCESS") continue;
    // Only include the user's own transactions
    if (tx.Account !== walletAddress) continue;

    const changes = getBalanceChanges(meta);

    let baseDelta = new BigNumber(0);
    let quoteDelta = new BigNumber(0);

    for (const acctChanges of changes) {
      if (acctChanges.account !== walletAddress) continue;

      for (const bal of acctChanges.balances) {
        const val = new BigNumber(bal.value);
        if (matchesCurrency(bal, baseCurrency, baseIssuer)) {
          baseDelta = baseDelta.plus(val);
        } else if (matchesCurrency(bal, quoteCurrency, quoteIssuer)) {
          quoteDelta = quoteDelta.plus(val);
        }
      }
    }

    // A fill requires meaningful changes on both sides of the pair.
    // Skip fee-only XRP changes (< 0.001) and zero deltas.
    const baseAmount = baseDelta.abs();
    const quoteAmount = quoteDelta.abs();
    if (baseAmount.lt(0.001) || quoteAmount.lt(0.001)) continue;

    // If user received base currency (positive delta), they bought
    const isBuy = baseDelta.gt(0);

    const time = (entry.close_time_iso as string) ?? (entry.date as string) ?? "";
    const hash = (entry.hash as string) ?? (tx.hash as string) ?? "";

    if (baseAmount.gt(0) && quoteAmount.gt(0)) {
      const price = quoteAmount.dividedBy(baseAmount);
      filled.push({
        side: isBuy ? "buy" : "sell",
        price: price.toPrecision(6),
        baseAmount: baseAmount.toPrecision(6),
        quoteAmount: quoteAmount.toPrecision(6),
        time,
        hash,
      });
    } else if (baseAmount.gt(0) || quoteAmount.gt(0)) {
      filled.push({
        side: isBuy ? "buy" : "sell",
        price: "—",
        baseAmount: baseAmount.gt(0) ? baseAmount.toPrecision(6) : "—",
        quoteAmount: quoteAmount.gt(0) ? quoteAmount.toPrecision(6) : "—",
        time,
        hash,
      });
    }
  }

  return filled;
}
