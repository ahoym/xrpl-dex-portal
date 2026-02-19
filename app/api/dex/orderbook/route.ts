import { NextRequest } from "next/server";
import { getXrplClient, validateCurrencyPair, apiErrorResponse } from "@/lib/api";
import type { CurrencyPair } from "@/lib/api";
import {
  fetchAndNormalizeOrderbook,
  fetchPermissionedOrderbook,
} from "@/lib/xrpl/orderbook-helpers";
import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";

export async function GET(request: NextRequest) {
  try {
    const domain = request.nextUrl.searchParams.get("domain") ?? undefined;

    const pairOrError = validateCurrencyPair(request);
    if (pairOrError instanceof Response) return pairOrError;

    if (domain && !DOMAIN_ID_REGEX.test(domain)) {
      return Response.json({ error: "Invalid domain ID format" }, { status: 400 });
    }

    const client = await getXrplClient(request);

    const { buy, sell, depth } = domain
      ? await fetchPermissionedOrderbook(client, pairOrError as CurrencyPair, domain)
      : await fetchAndNormalizeOrderbook(client, pairOrError as CurrencyPair);

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
