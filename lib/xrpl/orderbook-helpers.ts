import type { Client } from "xrpl";
import { encodeXrplCurrency } from "./currency";
import { normalizeOffer } from "./normalize-offer";
import { aggregateDepth } from "./aggregate-depth";
import { MAX_API_LIMIT } from "./constants";
import { Assets } from "@/lib/assets";
import type { CurrencyPair } from "@/lib/api";

/** Encode a validated CurrencyPair into XRPL Amount-like objects for getOrderbook(). */
export function encodeCurrencyPair(pair: CurrencyPair) {
  const currency1 = pair.baseCurrency === Assets.XRP
    ? { currency: Assets.XRP }
    : { currency: encodeXrplCurrency(pair.baseCurrency), issuer: pair.baseIssuer! };

  const currency2 = pair.quoteCurrency === Assets.XRP
    ? { currency: Assets.XRP }
    : { currency: encodeXrplCurrency(pair.quoteCurrency), issuer: pair.quoteIssuer! };

  return { currency1, currency2 };
}

/** Fetch orderbook, normalize offers, and compute depth. */
export async function fetchAndNormalizeOrderbook(
  client: Client,
  pair: CurrencyPair,
) {
  const { currency1, currency2 } = encodeCurrencyPair(pair);
  const orderbook = await client.getOrderbook(currency1, currency2, { limit: MAX_API_LIMIT });
  const buy = orderbook.buy.map(normalizeOffer);
  const sell = orderbook.sell.map(normalizeOffer);
  const { depth } = aggregateDepth(buy, sell);
  return { buy, sell, depth };
}
