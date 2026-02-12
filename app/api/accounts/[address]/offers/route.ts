import { NextRequest } from "next/server";
import { DEFAULT_ACCOUNT_OFFERS_LIMIT, MAX_API_LIMIT } from "@/lib/xrpl/constants";
import { fromXrplAmount } from "@/lib/xrpl/currency";
import { getXrplClient, getAndValidateAddress, apiErrorResponse, parseIntQueryParam } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const addressOrError = await getAndValidateAddress(params);
    if (addressOrError instanceof Response) return addressOrError;
    const address = addressOrError;

    const sp = request.nextUrl.searchParams;
    const limit = parseIntQueryParam(sp, "limit", DEFAULT_ACCOUNT_OFFERS_LIMIT, MAX_API_LIMIT);
    const rawMarker = sp.get("marker") ?? undefined;
    if (rawMarker !== undefined && (rawMarker.length === 0 || rawMarker.length > 256)) {
      return Response.json({ error: "Invalid marker value" }, { status: 400 });
    }
    const marker = rawMarker;

    const client = await getXrplClient(request);

    const response = await client.request({
      command: "account_offers",
      account: address,
      limit,
      marker,
      ledger_index: "validated",
    });

    const offers = response.result.offers?.map((offer) => ({
      seq: offer.seq,
      flags: offer.flags,
      taker_gets: fromXrplAmount(offer.taker_gets),
      taker_pays: fromXrplAmount(offer.taker_pays),
      quality: offer.quality,
      expiration: offer.expiration,
    })) ?? [];

    const result: Record<string, unknown> = { address, offers };
    if (response.result.marker) {
      result.marker = response.result.marker;
    }

    return Response.json(result);
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch offers", { checkNotFound: true });
  }
}
