import { getBalanceChanges } from "xrpl";
import type { TransactionMetadata, Amount } from "xrpl";
import { decodeCurrency } from "./currency";
import { matchesCurrency } from "./match-currency";
import { Assets } from "@/lib/assets";
import { TRADES_FETCH_MULTIPLIER } from "./constants";
import type { Client } from "xrpl";

const TRADES_CACHE_LIMIT = 50;

export interface Trade {
  side: "buy" | "sell";
  price: string;
  baseAmount: string;
  quoteAmount: string;
  account: string;
  time: string;
  hash: string;
}

/** In-memory cache keyed by "network:base:baseIssuer:quote:quoteIssuer" */
const tradesCache = new Map<string, Trade[]>();

export function tradesCacheKey(
  network: string,
  baseCurrency: string,
  baseIssuer: string | undefined,
  quoteCurrency: string,
  quoteIssuer: string | undefined,
): string {
  return `${network}:${baseCurrency}:${baseIssuer ?? ""}:${quoteCurrency}:${quoteIssuer ?? ""}`;
}

/** Convert an XRPL Amount to {currency, issuer} for comparison. */
export function amountCurrency(amt: Amount): { currency: string; issuer?: string } {
  if (typeof amt === "string") return { currency: Assets.XRP };
  return { currency: decodeCurrency(amt.currency), issuer: amt.issuer };
}

/** Fetch trades from XRPL and merge with the in-memory cache. */
export async function fetchAndCacheTrades(
  client: Client,
  network: string,
  baseCurrency: string,
  baseIssuer: string | undefined,
  quoteCurrency: string,
  quoteIssuer: string | undefined,
): Promise<Trade[]> {
  const issuerAccount = baseCurrency !== Assets.XRP ? baseIssuer! : quoteIssuer!;

  const response = await client.request({
    command: "account_tx",
    account: issuerAccount,
    limit: TRADES_CACHE_LIMIT * TRADES_FETCH_MULTIPLIER,
  });

  const newTrades: Trade[] = [];

  for (const entry of response.result.transactions) {
    if (newTrades.length >= TRADES_CACHE_LIMIT) break;

    const tx = entry.tx_json;
    const meta = entry.meta as TransactionMetadata | undefined;
    if (!tx || !meta) continue;
    if (tx.TransactionType !== "OfferCreate") continue;
    if (typeof meta === "string") continue;
    if (meta.TransactionResult !== "tesSUCCESS") continue;

    const changes = getBalanceChanges(meta);

    let baseTotal = 0;
    let quoteTotal = 0;

    for (const acctChanges of changes) {
      if (acctChanges.account === issuerAccount) continue;

      for (const bal of acctChanges.balances) {
        const val = parseFloat(bal.value);
        if (val <= 0) continue;

        if (matchesCurrency(bal, baseCurrency, baseIssuer)) {
          if (baseCurrency === Assets.XRP && acctChanges.account === tx.Account) {
            const fee = parseFloat(String(tx.Fee ?? "0")) / 1_000_000;
            baseTotal += val - fee;
          } else {
            baseTotal += val;
          }
        } else if (matchesCurrency(bal, quoteCurrency, quoteIssuer)) {
          if (quoteCurrency === Assets.XRP && acctChanges.account === tx.Account) {
            const fee = parseFloat(String(tx.Fee ?? "0")) / 1_000_000;
            quoteTotal += val - fee;
          } else {
            quoteTotal += val;
          }
        }
      }
    }

    if (baseTotal <= 0 || quoteTotal <= 0) continue;

    const takerPays = amountCurrency(tx.TakerPays as Amount);
    const isBuy =
      takerPays.currency === baseCurrency &&
      (baseCurrency === Assets.XRP || takerPays.issuer === baseIssuer);

    const entryAny = entry as unknown as Record<string, unknown>;
    const time = (entryAny.close_time_iso as string) ?? (entryAny.date as string) ?? "";
    const hash = (entryAny.hash as string) ?? (tx.hash as string | undefined) ?? "";

    const price = quoteTotal / baseTotal;

    newTrades.push({
      side: isBuy ? "buy" : "sell",
      price: price.toPrecision(6),
      baseAmount: baseTotal.toPrecision(6),
      quoteAmount: quoteTotal.toPrecision(6),
      account: tx.Account as string,
      time,
      hash,
    });
  }

  // Merge new trades into cache, dedup by hash, sort by time desc, cap at limit
  const key = tradesCacheKey(network ?? "", baseCurrency, baseIssuer, quoteCurrency, quoteIssuer);
  const cached = tradesCache.get(key) ?? [];
  const seen = new Set<string>();
  const merged: Trade[] = [];
  for (const trade of [...newTrades, ...cached]) {
    if (seen.has(trade.hash)) continue;
    seen.add(trade.hash);
    merged.push(trade);
  }
  merged.sort((a, b) => (b.time > a.time ? 1 : b.time < a.time ? -1 : 0));
  const capped = merged.slice(0, TRADES_CACHE_LIMIT);
  tradesCache.set(key, capped);

  return capped;
}
