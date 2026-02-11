import BigNumber from "bignumber.js";
import type { DepthSummary } from "@/lib/types";

interface OfferWithValue {
  taker_gets: { value: string };
}

/**
 * Compute depth totals from the full buy/sell arrays, then trim to `displayLimit`.
 *
 * - Bid depth (quote) = sum of `taker_gets.value` across buy offers
 *   (creator offers quote currency to buy base)
 * - Ask depth (base) = sum of `taker_gets.value` across sell offers
 *   (creator offers base currency to sell)
 */
export function aggregateDepth<T extends OfferWithValue>(
  buy: T[],
  sell: T[],
  displayLimit: number,
): { buy: T[]; sell: T[]; depth: DepthSummary } {
  let bidVolume = new BigNumber(0);
  for (const o of buy) {
    bidVolume = bidVolume.plus(o.taker_gets.value);
  }

  let askVolume = new BigNumber(0);
  for (const o of sell) {
    askVolume = askVolume.plus(o.taker_gets.value);
  }

  return {
    buy: buy.slice(0, displayLimit),
    sell: sell.slice(0, displayLimit),
    depth: {
      bidVolume: bidVolume.toFixed(),
      bidLevels: buy.length,
      askVolume: askVolume.toFixed(),
      askLevels: sell.length,
    },
  };
}
