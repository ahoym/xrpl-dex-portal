/**
 * Human-readable messages for common XRPL transaction engine result codes.
 * Used by txFailureResponse() to provide friendly error descriptions.
 */
export const TEC_MESSAGES: Record<string, string> = {
  tecPATH_DRY:
    "No payment path found. The recipient may not have a trust line for this currency, or the issuer may not have rippling enabled (required for peer-to-peer transfers).",
  tecPATH_PARTIAL: "Only part of the amount could be delivered due to insufficient liquidity.",
  tecNO_LINE: "The recipient does not have a trust line for this currency.",
  tecNO_LINE_INSUF_RESERVE:
    "The recipient cannot create the required trust line due to insufficient XRP reserve.",
  tecUNFUNDED_PAYMENT: "The sender does not have enough balance to cover this payment.",
  tecNO_DST: "The destination account does not exist on the ledger.",
  tecNO_DST_INSUF_XRP:
    "The destination account does not exist and the payment is not enough to fund it.",
  tecNO_PERMISSION: "The destination account does not allow incoming payments of this type.",
  tecINSUF_RESERVE_LINE: "The sender lacks the XRP reserve needed to hold this trust line.",
  tecFROZEN: "This trust line or currency has been frozen by the issuer.",
};

/** Look up a friendly message for an engine result code, with fallback. */
export function friendlyTxError(engineResult: string): string {
  return TEC_MESSAGES[engineResult] ?? "The transaction was rejected by the ledger.";
}
