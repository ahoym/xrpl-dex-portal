import { decodeCurrency } from "./decode-currency-client";
import { Assets } from "@/lib/assets";

/** Check whether an amount-like object matches a given currency + optional issuer. */
export function matchesCurrency(
  amt: { currency: string; issuer?: string },
  currency: string,
  issuer: string | undefined,
): boolean {
  const amtCurrency = decodeCurrency(amt.currency);
  if (amtCurrency !== currency && amt.currency !== currency) return false;
  if (currency === Assets.XRP) return true;
  return amt.issuer === issuer;
}
