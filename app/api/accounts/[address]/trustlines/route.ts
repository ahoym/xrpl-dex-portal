import { NextRequest } from "next/server";
import { TrustSet } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { getAndValidateAddress, getXrplClient, validateRequired, requireWallet, submitTxAndRespond, apiErrorResponse, isAccountNotFound } from "@/lib/api";
import type { TrustLineRequest } from "@/lib/xrpl/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const addressOrError = await getAndValidateAddress(params);
    if (addressOrError instanceof Response) return addressOrError;
    const address = addressOrError;

    const client = await getXrplClient(request);

    let lines;
    try {
      const response = await client.request({
        command: "account_lines",
        account: address,
        ledger_index: "validated",
      });
      lines = response.result.lines;
    } catch (err: unknown) {
      if (isAccountNotFound(err)) {
        return Response.json({ address, trustLines: [] });
      }
      throw err;
    }

    return Response.json({
      address,
      trustLines: lines,
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to fetch trust lines");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const addressOrError = await getAndValidateAddress(params);
    if (addressOrError instanceof Response) return addressOrError;
    const address = addressOrError;

    const body: TrustLineRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "currency", "issuer", "limit"]);
    if (invalid) return invalid;

    const client = await getClient(resolveNetwork(body.network));

    const walletResult = requireWallet(body.seed, address);
    if ("error" in walletResult) return walletResult.error;
    const wallet = walletResult.wallet;

    const trustSet: TrustSet = {
      TransactionType: "TrustSet",
      Account: wallet.address,
      LimitAmount: {
        currency: encodeXrplCurrency(body.currency),
        issuer: body.issuer,
        value: body.limit,
      },
    };

    return submitTxAndRespond(client, trustSet, wallet);
  } catch (err) {
    return apiErrorResponse(err, "Failed to set trust line");
  }
}
