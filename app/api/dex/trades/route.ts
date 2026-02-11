import { NextRequest } from "next/server";
import { getBalanceChanges } from "xrpl";
import type { TransactionMetadata, Amount } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { decodeCurrency } from "@/lib/xrpl/currency";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { getNetworkParam, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import { TRADES_FETCH_MULTIPLIER } from "@/lib/xrpl/constants";
import { Assets } from "@/lib/assets";

const TRADES_CACHE_LIMIT = 50;

interface Trade {
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

function cacheKey(network: string, baseCurrency: string, baseIssuer: string | undefined, quoteCurrency: string, quoteIssuer: string | undefined): string {
  return `${network}:${baseCurrency}:${baseIssuer ?? ""}:${quoteCurrency}:${quoteIssuer ?? ""}`;
}

/** Convert an XRPL Amount to {currency, issuer} for comparison */
function amountCurrency(amt: Amount): { currency: string; issuer?: string } {
  if (typeof amt === "string") return { currency: Assets.XRP };
  return { currency: decodeCurrency(amt.currency), issuer: amt.issuer };
}

export async function GET(request: NextRequest) {
  try {
    const network = getNetworkParam(request);

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    // Determine the issuer account to query — since all issued currency movements
    // touch the issuer's RippleState entries, querying the issuer's account_tx
    // captures ALL trades for that currency regardless of who submitted them.
    const issuerAccount = baseCurrency !== Assets.XRP ? baseIssuer! : quoteIssuer!;

    const client = await getClient(resolveNetwork(network));

    // Fetch more txns than needed since many won't be matching trades
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

      // Use getBalanceChanges to find actually executed amounts
      const changes = getBalanceChanges(meta);

      // Sum positive balance changes for base and quote across non-issuer accounts
      let baseTotal = 0;
      let quoteTotal = 0;

      for (const acctChanges of changes) {
        // Skip issuer's entries — trust line changes are mirror-images that would double-count
        if (acctChanges.account === issuerAccount) continue;

        for (const bal of acctChanges.balances) {
          const val = parseFloat(bal.value);
          if (val <= 0) continue;

          if (matchesCurrency(bal, baseCurrency, baseIssuer)) {
            // Transaction fee is only paid in XRP by the submitting account — subtract it to get the net traded amount
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

      // Both sides must have executed amounts (otherwise the offer just rested)
      if (baseTotal <= 0 || quoteTotal <= 0) continue;

      // Determine side: if TakerPays matches base currency, it's a buy (taker is buying base)
      const takerPays = amountCurrency(tx.TakerPays as Amount);
      const isBuy =
        takerPays.currency === baseCurrency &&
        (baseCurrency === Assets.XRP || takerPays.issuer === baseIssuer);

      // Extract time and hash from entry fields
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
    const key = cacheKey(network ?? "", baseCurrency, baseIssuer, quoteCurrency, quoteIssuer);
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

    return Response.json(
      {
        base: { currency: baseCurrency, issuer: baseIssuer },
        quote: { currency: quoteCurrency, issuer: quoteIssuer },
        trades: capped,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3, stale-while-revalidate=6",
        },
      },
    );
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch recent trades");
  }
}
