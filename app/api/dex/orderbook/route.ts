import { NextRequest } from "next/server";
import { getXrplClient, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import type { CurrencyPair } from "@/lib/api";
import { fetchAndNormalizeOrderbook } from "@/lib/xrpl/orderbook-helpers";

export async function GET(request: NextRequest) {
  try {
    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;

    const client = await getXrplClient(request);

    const { buy, sell, depth } = await fetchAndNormalizeOrderbook(client, pairOrError as CurrencyPair);

    return Response.json(
      {
        base: { currency: pairOrError.baseCurrency, issuer: pairOrError.baseIssuer },
        quote: { currency: pairOrError.quoteCurrency, issuer: pairOrError.quoteIssuer },
        buy,
        sell,
        depth,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3, stale-while-revalidate=6",
        },
      },
    );
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch order book");
  }
}
