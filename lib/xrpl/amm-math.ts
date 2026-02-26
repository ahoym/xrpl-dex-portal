import BigNumber from "bignumber.js";
import type { AmmPoolInfo } from "@/lib/types";

export interface AmmPoolParams {
  baseReserves: BigNumber;
  quoteReserves: BigNumber;
  /** tradingFee / 100_000 */
  feeRate: BigNumber;
}

const FEE_DIVISOR = 100_000;

/**
 * Build AmmPoolParams from an AmmPoolInfo.
 * Returns null if pool doesn't exist, reserves are zero, or either asset is frozen.
 */
export function buildAmmPoolParams(pool: AmmPoolInfo | null | undefined): AmmPoolParams | null {
  if (!pool || !pool.exists) return null;
  if (pool.asset1Frozen || pool.asset2Frozen) return null;

  const baseReserves = new BigNumber(pool.asset1Value);
  const quoteReserves = new BigNumber(pool.asset2Value);

  if (baseReserves.isZero() || quoteReserves.isZero()) return null;

  return {
    baseReserves,
    quoteReserves,
    feeRate: new BigNumber(pool.tradingFee).div(FEE_DIVISOR),
  };
}

/**
 * Marginal buy price (quote/base) after `consumed` base has already been bought.
 *
 * Formula: Q*B / ((B - consumed)^2 * (1-f))
 *
 * Fee is on quote input, so the marginal cost is higher than the no-fee price.
 */
export function ammMarginalBuyPrice(pool: AmmPoolParams, consumed: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const remaining = pool.baseReserves.minus(consumed);
  return pool.quoteReserves.times(pool.baseReserves).div(remaining.pow(2).times(oneMinusF));
}

/**
 * Marginal sell price (quote/base) after `consumed` base has already been sold.
 *
 * Formula: Q*B*(1-f) / (B + consumed*(1-f))^2
 *
 * Fee is on base input, so the marginal proceeds are lower than the no-fee price.
 */
export function ammMarginalSellPrice(pool: AmmPoolParams, consumed: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const effective = pool.baseReserves.plus(consumed.times(oneMinusF));
  return pool.quoteReserves.times(pool.baseReserves).times(oneMinusF).div(effective.pow(2));
}

/**
 * Max base that can be bought before the marginal buy price reaches `priceLimit`.
 *
 * Formula: B - sqrt(Q*B / (P*(1-f))), clamped to 0
 */
export function ammMaxBuyBeforePrice(pool: AmmPoolParams, priceLimit: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const inner = pool.quoteReserves.times(pool.baseReserves).div(priceLimit.times(oneMinusF));
  const result = pool.baseReserves.minus(inner.sqrt());
  return BigNumber.max(result, 0);
}

/**
 * Max base that can be sold before the marginal sell price drops to `priceLimit`.
 *
 * Formula: (sqrt(Q*B*(1-f) / P) - B) / (1-f), clamped to 0
 */
export function ammMaxSellBeforePrice(pool: AmmPoolParams, priceLimit: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const inner = pool.quoteReserves.times(pool.baseReserves).times(oneMinusF).div(priceLimit);
  const result = inner.sqrt().minus(pool.baseReserves).div(oneMinusF);
  return BigNumber.max(result, 0);
}

/**
 * Quote cost of buying `delta` base from the AMM, starting after `consumed` base
 * has already been bought.
 *
 * Fee is on quote input (gross cost = effective / (1-f)).
 *
 * Formula: Q*B*delta / ((B-consumed-delta)*(B-consumed)*(1-f))
 */
export function ammBuyCost(pool: AmmPoolParams, delta: BigNumber, consumed: BigNumber): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const before = pool.baseReserves.minus(consumed);
  const after = before.minus(delta);
  // Effective quote needed = k/after - k/before = k * delta / (before * after)
  // Gross = effective / (1-f)
  return pool.quoteReserves
    .times(pool.baseReserves)
    .times(delta)
    .div(before.times(after).times(oneMinusF));
}

/**
 * Quote received for selling `delta` base to the AMM, starting after `consumed` base
 * has already been sold.
 *
 * Fee is on base input (effective base = delta*(1-f)).
 *
 * Formula: Q*B*delta*(1-f) / ((B+consumed*(1-f)) * (B+(consumed+delta)*(1-f)))
 */
export function ammSellProceeds(
  pool: AmmPoolParams,
  delta: BigNumber,
  consumed: BigNumber,
): BigNumber {
  const oneMinusF = new BigNumber(1).minus(pool.feeRate);
  const before = pool.baseReserves.plus(consumed.times(oneMinusF));
  const after = pool.baseReserves.plus(consumed.plus(delta).times(oneMinusF));
  return pool.quoteReserves
    .times(pool.baseReserves)
    .times(delta)
    .times(oneMinusF)
    .div(before.times(after));
}
