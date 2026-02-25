/**
 * AMM trading-fee helpers.
 *
 * XRPL stores the trading fee as an integer in units of 1/100,000 (0.001%).
 * A fee value of 1000 = 1%.
 */

const FEE_DIVISOR = 100_000;
const PERCENT_FACTOR = 100;

/**
 * Format a raw XRPL AMM trading fee integer as a human-readable percentage string.
 * e.g. 1000 → "1%", 500 → "0.5%", 0 → "0%"
 */
export function formatAmmFee(tradingFee: number): string {
  const pct = (tradingFee / FEE_DIVISOR) * PERCENT_FACTOR;
  // Strip trailing zeros: 0.50 → "0.5", 1.00 → "1"
  return `${parseFloat(pct.toFixed(3))}%`;
}

/**
 * Parse a percentage string into the raw XRPL AMM trading fee integer.
 * e.g. "1" → 1000, "0.5" → 500
 *
 * Returns NaN if the input is not a valid number.
 */
export function parseAmmFeeInput(percentStr: string): number {
  const pct = parseFloat(percentStr);
  if (Number.isNaN(pct)) return NaN;
  return Math.round((pct / PERCENT_FACTOR) * FEE_DIVISOR);
}
