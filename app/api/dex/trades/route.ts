import { NextRequest } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { getNetworkParam, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import { fetchAndCacheTrades } from "@/lib/xrpl/trades";

export async function GET(request: NextRequest) {
  try {
    const network = getNetworkParam(request);

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    const client = await getClient(resolveNetwork(network));

    const trades = await fetchAndCacheTrades(
      client,
      network ?? "",
      baseCurrency,
      baseIssuer,
      quoteCurrency,
      quoteIssuer,
    );

    return Response.json(
      {
        base: { currency: baseCurrency, issuer: baseIssuer },
        quote: { currency: quoteCurrency, issuer: quoteIssuer },
        trades,
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
