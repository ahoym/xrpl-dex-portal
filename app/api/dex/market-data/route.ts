import { NextRequest } from "next/server";
import { getXrplClient, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import type { CurrencyPair } from "@/lib/api";
import { fetchAndNormalizeOrderbook } from "@/lib/xrpl/orderbook-helpers";
import { fetchAndCacheTrades } from "@/lib/xrpl/trades";

export async function GET(request: NextRequest) {
  try {
    const network = request.nextUrl.searchParams.get("network") ?? undefined;

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    const client = await getXrplClient(request);

    // Fetch orderbook and trades sequentially over the same connection.
    // Each in its own try/catch so a failure in one doesn't block the other.

    let orderbook: Awaited<ReturnType<typeof fetchAndNormalizeOrderbook>> | null = null;
    let depth: Awaited<ReturnType<typeof fetchAndNormalizeOrderbook>>["depth"] | null = null;
    try {
      const result = await fetchAndNormalizeOrderbook(client, pairOrError as CurrencyPair);
      // Note: getOrderbook splits by lsfSell flag, not currency direction.
      // The client re-categorises into asks/bids by currency, so we must
      // send the full arrays — trimming here would discard cross-flagged offers.
      orderbook = { buy: result.buy, sell: result.sell, depth: result.depth };
      depth = result.depth;
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
        orderbook: orderbook ? { buy: orderbook.buy, sell: orderbook.sell } : null,
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
