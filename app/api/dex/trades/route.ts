import { NextRequest } from "next/server";
import { getXrplClient, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import { fetchAndCacheTrades } from "@/lib/xrpl/trades";

export async function GET(request: NextRequest) {
  try {
    const network = request.nextUrl.searchParams.get("network") ?? undefined;

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;
    const { baseCurrency, baseIssuer, quoteCurrency, quoteIssuer } = pairOrError;

    const client = await getXrplClient(request);

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
