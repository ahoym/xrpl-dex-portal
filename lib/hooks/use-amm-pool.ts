"use client";

import { useApiFetch } from "./use-api-fetch";
import type { AmmPoolInfo, PersistedState } from "@/lib/types";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { Assets } from "@/lib/assets";

/**
 * Fetch AMM pool info for a currency pair.
 * Returns `{ pool, loading, error, refresh }`.
 */
export function useAmmPool(
  baseCurrency: string | undefined,
  baseIssuer: string | undefined,
  quoteCurrency: string | undefined,
  quoteIssuer: string | undefined,
  network: PersistedState["network"],
  refreshKey?: number,
) {
  const { data, loading, error, refresh } = useApiFetch<AmmPoolInfo>(
    () => {
      if (!baseCurrency || !quoteCurrency) return null;

      const params = new URLSearchParams({ network });
      params.set("base_currency", encodeXrplCurrency(baseCurrency));
      if (baseCurrency !== Assets.XRP && baseIssuer) {
        params.set("base_issuer", baseIssuer);
      }
      params.set("quote_currency", encodeXrplCurrency(quoteCurrency));
      if (quoteCurrency !== Assets.XRP && quoteIssuer) {
        params.set("quote_issuer", quoteIssuer);
      }

      return `/api/amm/info?${params.toString()}`;
    },
    (json) => [json as unknown as AmmPoolInfo],
    refreshKey,
  );

  return { pool: data[0] ?? null, loading, error, refresh };
}
