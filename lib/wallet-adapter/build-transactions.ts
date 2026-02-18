/**
 * Client-side XRPL transaction builder.
 *
 * Mirrors the transaction objects built in API routes, but without signing.
 * Used by extension wallet adapters (Crossmark, MetaMask Snap) that need
 * raw XRPL transaction JSON to pass to their sign-and-submit methods.
 */

import type { Payment, OfferCreate, OfferCancel, TrustSet } from "xrpl";
import { xrpToDrops } from "xrpl";
import { toXrplAmount } from "../xrpl/currency";
import { resolveOfferFlags } from "../xrpl/offers";
import { encodeXrplCurrency } from "../xrpl/currency";
import { Assets } from "../assets";
import type { PaymentParams, CreateOfferParams, CancelOfferParams, TrustlineParams } from "./types";

export function buildPaymentTx(params: PaymentParams, account: string): Payment {
  const isXrp = params.currencyCode === Assets.XRP;

  let amount: Payment["Amount"];
  if (isXrp) {
    amount = xrpToDrops(params.amount);
  } else {
    if (!params.issuerAddress) {
      throw new Error(`issuerAddress is required for non-XRP currency "${params.currencyCode}"`);
    }
    amount = {
      currency: encodeXrplCurrency(params.currencyCode),
      issuer: params.issuerAddress,
      value: params.amount,
    };
  }

  const payment: Payment = {
    TransactionType: "Payment",
    Account: account,
    Destination: params.recipientAddress,
    Amount: amount,
  };

  if (params.destinationTag !== undefined) {
    payment.DestinationTag = params.destinationTag;
  }

  return payment;
}

export function buildOfferCreateTx(params: CreateOfferParams, account: string): OfferCreate {
  const tx: OfferCreate = {
    TransactionType: "OfferCreate",
    Account: account,
    TakerGets: toXrplAmount(params.takerGets),
    TakerPays: toXrplAmount(params.takerPays),
  };

  const flags = resolveOfferFlags(params.flags);
  if (flags !== undefined) {
    tx.Flags = flags;
  }

  if (params.expiration !== undefined) {
    tx.Expiration = params.expiration;
  }

  if (params.domainID) {
    tx.DomainID = params.domainID;
  }

  return tx;
}

export function buildOfferCancelTx(params: CancelOfferParams, account: string): OfferCancel {
  return {
    TransactionType: "OfferCancel",
    Account: account,
    OfferSequence: params.offerSequence,
  };
}

export function buildTrustSetTx(params: TrustlineParams, account: string): TrustSet {
  return {
    TransactionType: "TrustSet",
    Account: account,
    LimitAmount: {
      currency: encodeXrplCurrency(params.currency),
      issuer: params.issuer,
      value: params.limit,
    },
  };
}
