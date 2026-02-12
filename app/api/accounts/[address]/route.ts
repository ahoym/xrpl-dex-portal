import { NextRequest } from "next/server";
import { getXrplClient, getAndValidateAddress, apiErrorResponse } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const addressOrError = await getAndValidateAddress(params);
    if (addressOrError instanceof Response) return addressOrError;
    const address = addressOrError;

    const client = await getXrplClient(request);

    const response = await client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
    });

    return Response.json(response.result);
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch account info", { checkNotFound: true });
  }
}
