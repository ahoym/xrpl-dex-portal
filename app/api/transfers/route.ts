import { NextRequest } from "next/server";
import { Payment, xrpToDrops } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { validateRequired, requireWallet, validateAddress, validateDexAmount, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { TransferRequest } from "@/lib/xrpl/types";
import { Assets } from "@/lib/assets";

export async function POST(request: NextRequest) {
  try {
    const body: TransferRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["senderSeed", "recipientAddress", "currencyCode", "amount"]);
    if (invalid) return invalid;

    const walletResult = requireWallet(body.senderSeed);
    if ("error" in walletResult) return walletResult.error;
    const senderWallet = walletResult.wallet;

    const badRecipient = validateAddress(body.recipientAddress, "recipientAddress");
    if (badRecipient) return badRecipient;

    const badAmount = validateDexAmount(
      { currency: body.currencyCode, value: body.amount, issuer: body.issuerAddress },
      "amount",
    );
    if (badAmount) return badAmount;

    const client = await getClient(resolveNetwork(body.network));
    const isXrp = body.currencyCode === Assets.XRP;

    const payment: Payment = {
      TransactionType: "Payment",
      Account: senderWallet.address,
      Destination: body.recipientAddress,
      Amount: isXrp
        ? xrpToDrops(body.amount)
        : {
            currency: encodeXrplCurrency(body.currencyCode),
            issuer: body.issuerAddress!,
            value: body.amount,
          },
    };

    if (body.destinationTag !== undefined) {
      payment.DestinationTag = body.destinationTag;
    }

    const result = await client.submitAndWait(payment, { wallet: senderWallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({
      result: result.result,
    }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to transfer currency");
  }
}
