import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { getNetworkParam, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import { DEFAULT_ORDERBOOK_LIMIT, MAX_API_LIMIT } from "@/lib/xrpl/constants";
import { Assets } from "@/lib/assets";
import { normalizeOffer } from "@/lib/xrpl/normalize-offer";
import { fetchAndCacheTrades } from "@/lib/xrpl/trades";
import { aggregateDepth } from "@/lib/xrpl/aggregate-depth";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const rawLimit = parseInt(sp.get("limit") ?? "", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? DEFAULT_ORDERBOOK_LIMIT : rawLimit, MAX_API_LIMIT);
    const network = getNetworkParam(request);

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    const client = await getClient(resolveNetwork(network));

    const currency1 = baseCurrency === Assets.XRP
      ? { currency: Assets.XRP }
      : { currency: encodeXrplCurrency(baseCurrency), issuer: baseIssuer! };

    const currency2 = quoteCurrency === Assets.XRP
      ? { currency: Assets.XRP }
      : { currency: encodeXrplCurrency(quoteCurrency), issuer: quoteIssuer! };

    // Fetch orderbook and trades sequentially over the same connection.
    // Each in its own try/catch so a failure in one doesn't block the other.

    let orderbook: { buy: ReturnType<typeof normalizeOffer>[]; sell: ReturnType<typeof normalizeOffer>[] } | null = null;
    let depth: ReturnType<typeof aggregateDepth>["depth"] | null = null;
    try {
      const ob = await client.getOrderbook(currency1, currency2, { limit: MAX_API_LIMIT });
      const allBuy = ob.buy.map(normalizeOffer);
      const allSell = ob.sell.map(normalizeOffer);
      const agg = aggregateDepth(allBuy, allSell, limit);
      orderbook = { buy: agg.buy, sell: agg.sell };
      depth = agg.depth;
    } catch {
      // orderbook stays null — partial failure
    }

    let trades: Awaited<ReturnType<typeof fetchAndCacheTrades>> | null = null;
    try {
      trades = await fetchAndCacheTrades(
        client,
        network ?? "",
        baseCurrency,
        baseIssuer,
        quoteCurrency,
        quoteIssuer,
      );
    } catch {
      // trades stays null — partial failure
    }

    return Response.json(
      {
        base: { currency: baseCurrency, issuer: baseIssuer },
        quote: { currency: quoteCurrency, issuer: quoteIssuer },
        orderbook,
        depth,
        trades,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3, stale-while-revalidate=6",
        },
      },
    );
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch market data");
  }
}
