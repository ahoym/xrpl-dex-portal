import type { Client, BookOffersRequest, BookOffer } from "xrpl";
import { encodeXrplCurrency } from "./currency";
import { normalizeOffer } from "./normalize-offer";
import { aggregateDepth } from "./aggregate-depth";
import { MAX_API_LIMIT } from "./constants";
import { Assets } from "@/lib/assets";
import type { CurrencyPair } from "@/lib/api";
import type { DepthSummary } from "@/lib/types";

/** Return shape shared by fetchAndNormalizeOrderbook and fetchPermissionedOrderbook. */
export interface OrderbookResult {
  buy: ReturnType<typeof normalizeOffer>[];
  sell: ReturnType<typeof normalizeOffer>[];
  depth: DepthSummary;
}

/** Encode a validated CurrencyPair into XRPL Amount-like objects for getOrderbook(). */
export function encodeCurrencyPair(pair: CurrencyPair) {
  const currency1 =
    pair.baseCurrency === Assets.XRP
      ? { currency: Assets.XRP }
      : { currency: encodeXrplCurrency(pair.baseCurrency), issuer: pair.baseIssuer! };

  const currency2 =
    pair.quoteCurrency === Assets.XRP
      ? { currency: Assets.XRP }
      : { currency: encodeXrplCurrency(pair.quoteCurrency), issuer: pair.quoteIssuer! };

  return { currency1, currency2 };
}

/** Fetch orderbook, normalize offers, and compute depth. */
export async function fetchAndNormalizeOrderbook(
  client: Client,
  pair: CurrencyPair,
): Promise<OrderbookResult> {
  const { currency1, currency2 } = encodeCurrencyPair(pair);
  const orderbook = await client.getOrderbook(currency1, currency2, { limit: MAX_API_LIMIT });
  const buy = orderbook.buy.map(normalizeOffer);
  const sell = orderbook.sell.map(normalizeOffer);
  const { depth } = aggregateDepth(buy, sell);
  return { buy, sell, depth };
}

/** Fetch a permissioned orderbook via raw book_offers RPC (domain-filtered). */
export async function fetchPermissionedOrderbook(
  client: Client,
  pair: CurrencyPair,
  domain: string,
): Promise<OrderbookResult> {
  const { currency1, currency2 } = encodeCurrencyPair(pair);
  const [askRes, bidRes] = await Promise.all([
    client.request({
      command: "book_offers",
      taker_gets: currency1,
      taker_pays: currency2,
      limit: MAX_API_LIMIT,
      domain,
    } satisfies BookOffersRequest),
    client.request({
      command: "book_offers",
      taker_gets: currency2,
      taker_pays: currency1,
      limit: MAX_API_LIMIT,
      domain,
    } satisfies BookOffersRequest),
  ]);
  const sell = (askRes.result.offers as BookOffer[]).map(normalizeOffer);
  const buy = (bidRes.result.offers as BookOffer[]).map(normalizeOffer);
  const { depth } = aggregateDepth(buy, sell);
  return { buy, sell, depth };
}
