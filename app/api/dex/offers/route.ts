import { NextRequest } from "next/server";
import { OfferCreate } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { toXrplAmount } from "@/lib/xrpl/currency";
import { resolveOfferFlags, VALID_OFFER_FLAGS } from "@/lib/xrpl/offers";
import {
  validateRequired,
  requireWallet,
  validateDexAmount,
  submitTxAndRespond,
  apiErrorResponse,
} from "@/lib/api";
import type { CreateOfferRequest, OfferFlag, ApiError } from "@/lib/xrpl/types";
import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";

export async function POST(request: NextRequest) {
  try {
    const body: CreateOfferRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, [
      "seed",
      "takerGets",
      "takerPays",
    ]);
    if (invalid) return invalid;

    const badGets = validateDexAmount(body.takerGets, "takerGets");
    if (badGets) return badGets;

    const badPays = validateDexAmount(body.takerPays, "takerPays");
    if (badPays) return badPays;

    if (body.expiration !== undefined) {
      if (!Number.isInteger(body.expiration) || body.expiration <= 0) {
        return Response.json(
          { error: "expiration must be a positive integer" } satisfies ApiError,
          { status: 400 },
        );
      }
    }

    if (body.offerSequence !== undefined) {
      if (!Number.isInteger(body.offerSequence) || body.offerSequence < 0) {
        return Response.json(
          { error: "offerSequence must be a non-negative integer" } satisfies ApiError,
          { status: 400 },
        );
      }
    }

    if (body.domainID !== undefined) {
      if (typeof body.domainID !== "string" || !DOMAIN_ID_REGEX.test(body.domainID)) {
        return Response.json(
          { error: "domainID must be a 64-character uppercase hex string" } satisfies ApiError,
          { status: 400 },
        );
      }
    }

    if (body.flags) {
      const invalid = body.flags.filter((f) => !VALID_OFFER_FLAGS.includes(f as OfferFlag));
      if (invalid.length > 0) {
        return Response.json(
          {
            error: `Unknown offer flags: ${invalid.join(", ")}. Valid flags: ${VALID_OFFER_FLAGS.join(", ")}`,
          } satisfies ApiError,
          { status: 400 },
        );
      }
    }

    const walletResult = requireWallet(body.seed);
    if ("error" in walletResult) return walletResult.error;
    const wallet = walletResult.wallet;

    const client = await getClient(resolveNetwork(body.network));

    const tx: OfferCreate = {
      TransactionType: "OfferCreate",
      Account: wallet.address,
      TakerGets: toXrplAmount(body.takerGets),
      TakerPays: toXrplAmount(body.takerPays),
    };

    const flags = resolveOfferFlags(body.flags);
    if (flags !== undefined) {
      tx.Flags = flags;
    }

    if (body.expiration !== undefined) {
      tx.Expiration = body.expiration;
    }

    if (body.offerSequence !== undefined) {
      tx.OfferSequence = body.offerSequence;
    }

    if (body.domainID) {
      tx.DomainID = body.domainID;
    }

    return submitTxAndRespond(client, tx, wallet);
  } catch (err) {
    return apiErrorResponse(err, "Failed to create offer");
  }
}
