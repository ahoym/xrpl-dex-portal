import { NextRequest } from "next/server";
import { DEFAULT_TRANSACTION_LIMIT, MAX_API_LIMIT } from "@/lib/xrpl/constants";
import { getXrplClient, getAndValidateAddress, apiErrorResponse, parseIntQueryParam } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const addressOrError = await getAndValidateAddress(params);
    if (addressOrError instanceof Response) return addressOrError;
    const address = addressOrError;

    const limit = parseIntQueryParam(request.nextUrl.searchParams, "limit", DEFAULT_TRANSACTION_LIMIT, MAX_API_LIMIT);
    const client = await getXrplClient(request);

    const response = await client.request({
      command: "account_tx",
      account: address,
      limit,
    });

    return Response.json({
      address,
      transactions: response.result.transactions,
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch transactions", { checkNotFound: true });
  }
}
