import { NextRequest } from "next/server";
import type { CredentialDelete } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { validateRequired, validateAddress, validateCredentialType, requireWallet, submitTxAndRespond, apiErrorResponse } from "@/lib/api";
import type { DeleteCredentialRequest } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: DeleteCredentialRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["seed", "issuer", "credentialType"]);
    if (invalid) return invalid;

    const badIssuer = validateAddress(body.issuer, "issuer");
    if (badIssuer) return badIssuer;

    const badType = validateCredentialType(body.credentialType);
    if (badType) return badType;

    const walletResult = requireWallet(body.seed);
    if ("error" in walletResult) return walletResult.error;
    const wallet = walletResult.wallet;

    const client = await getClient(resolveNetwork(body.network));

    const tx: CredentialDelete = {
      TransactionType: "CredentialDelete",
      Account: wallet.address,
      Issuer: body.issuer,
      CredentialType: encodeCredentialType(body.credentialType),
    };

    return submitTxAndRespond(client, tx, wallet);
  } catch (err) {
    return apiErrorResponse(err, "Failed to delete credential");
  }
}
