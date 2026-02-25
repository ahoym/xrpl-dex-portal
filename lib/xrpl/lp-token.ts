import { HEX_CURRENCY_CODE_LENGTH } from "./constants";

/**
 * LP token currency codes are 40-char hex strings starting with "03".
 * The prefix 0x03 is reserved by the XRPL for AMM LP tokens.
 */
const LP_TOKEN_PREFIX = "03";

/**
 * Check if a raw currency code is an AMM LP token.
 * LP tokens use a 40-char hex code starting with "03".
 */
export function isLpTokenCurrency(currency: string): boolean {
  return currency.length === HEX_CURRENCY_CODE_LENGTH && currency.startsWith(LP_TOKEN_PREFIX);
}

/**
 * Format a human-readable label for an LP token.
 * Returns "LP Token" for brevity — the full hex is available on the balance entry.
 */
export function formatLpTokenLabel(): string {
  return "LP Token";
}
