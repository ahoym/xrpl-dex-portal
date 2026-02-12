import { NextRequest } from "next/server";
import { Payment, xrpToDrops } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { validateRequired, walletFromSeed, validateAddress, validateDexAmount, getTransactionResult, apiErrorResponse } from "@/lib/api";
import type { TransferRequest, ApiError } from "@/lib/xrpl/types";
import { Assets } from "@/lib/assets";

const tecMessages: Record<string, string> = {
  tecPATH_DRY: "No payment path found. The recipient may not have a trust line for this currency, or the issuer may not have rippling enabled (required for peer-to-peer transfers).",
  tecPATH_PARTIAL: "Only part of the amount could be delivered due to insufficient liquidity.",
  tecNO_LINE: "The recipient does not have a trust line for this currency.",
  tecNO_LINE_INSUF_RESERVE: "The recipient cannot create the required trust line due to insufficient XRP reserve.",
  tecUNFUNDED_PAYMENT: "The sender does not have enough balance to cover this payment.",
  tecNO_DST: "The destination account does not exist on the ledger.",
  tecNO_DST_INSUF_XRP: "The destination account does not exist and the payment is not enough to fund it.",
  tecNO_PERMISSION: "The destination account does not allow incoming payments of this type.",
  tecINSUF_RESERVE_LINE: "The sender lacks the XRP reserve needed to hold this trust line.",
  tecFROZEN: "This trust line or currency has been frozen by the issuer.",
};

export async function POST(request: NextRequest) {
  try {
    const body: TransferRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["senderSeed", "recipientAddress", "currencyCode", "amount"]);
    if (invalid) return invalid;

    const seedResult = walletFromSeed(body.senderSeed);
    if ("error" in seedResult) return seedResult.error;
    const senderWallet = seedResult.wallet;

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

    const engineResult = getTransactionResult(result.result.meta);
    if (engineResult && engineResult !== "tesSUCCESS") {
      const friendly = tecMessages[engineResult] ?? "The transaction was rejected by the ledger.";
      return Response.json(
        { error: `${friendly} (${engineResult})` } satisfies ApiError,
        { status: 400 },
      );
    }

    return Response.json({
      result: result.result,
    }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to transfer currency");
  }
}
