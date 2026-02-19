import { NextRequest } from "next/server";
import { DEFAULT_ACCOUNT_OFFERS_LIMIT, MAX_API_LIMIT } from "@/lib/xrpl/constants";
import { fromXrplAmount } from "@/lib/xrpl/currency";
import {
  getXrplClient,
  getAndValidateAddress,
  apiErrorResponse,
  parseIntQueryParam,
} from "@/lib/api";

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

    // Use account_objects instead of account_offers to get full ledger entries
    // which include DomainID for permissioned domain offers.
    const response = await client.request({
      command: "account_objects",
      account: address,
      type: "offer",
      limit,
      marker,
      ledger_index: "validated",
    });

    const offers = (response.result.account_objects ?? []).map((obj) => {
      const raw = obj as unknown as Record<string, unknown>;
      return {
        seq: raw.Sequence as number,
        flags: raw.Flags as number,
        taker_gets: fromXrplAmount(
          raw.TakerGets as string | { currency: string; issuer: string; value: string },
        ),
        taker_pays: fromXrplAmount(
          raw.TakerPays as string | { currency: string; issuer: string; value: string },
        ),
        quality: raw.quality as string | undefined,
        expiration: raw.Expiration as number | undefined,
        ...(raw.DomainID ? { domainID: raw.DomainID as string } : {}),
      };
    });

    const result: Record<string, unknown> = { address, offers };
    if (response.result.marker) {
      result.marker = response.result.marker;
    }

    return Response.json(result);
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch offers", { checkNotFound: true });
  }
}
