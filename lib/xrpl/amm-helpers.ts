import type { Currency } from "xrpl";
import { Assets } from "@/lib/assets";
import { encodeXrplCurrency } from "./currency";

/**
 * Build an XRPL Currency identifier object (no amount) for use with `amm_info`.
 *
 * - XRP → `{ currency: "XRP" }`
 * - Issued currency → `{ currency: <hex-encoded>, issuer }`
 */
export function buildCurrencySpec(
  currency: string,
  issuer?: string,
): Currency {
  if (currency === Assets.XRP) {
    return { currency: "XRP" };
  }
  if (!issuer) {
    throw new Error(`issuer is required for non-XRP currency "${currency}"`);
  }
  return { currency: encodeXrplCurrency(currency), issuer };
}
