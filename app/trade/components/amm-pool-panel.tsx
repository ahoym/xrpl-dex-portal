"use client";

import BigNumber from "bignumber.js";
import type { AmmPoolInfo } from "@/lib/types";
import { formatAmmFee } from "@/lib/xrpl/amm-fee";
import { cardClass } from "@/lib/ui/ui";

interface AmmPoolPanelProps {
  pool: AmmPoolInfo | null;
  loading: boolean;
  pairSelected: boolean;
  baseCurrency?: string;
  quoteCurrency?: string;
  onRefresh?: () => void;
}

export function AmmPoolPanel({
  pool,
  loading,
  pairSelected,
  baseCurrency,
  quoteCurrency,
  onRefresh,
}: AmmPoolPanelProps) {
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          AMM Pool
          {pairSelected && baseCurrency && quoteCurrency && (
            <span className="ml-2 text-sm font-normal text-zinc-400 dark:text-zinc-500">
              {baseCurrency}/{quoteCurrency}
            </span>
          )}
        </h3>
        {onRefresh && pairSelected && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
          ))}
        </div>
      ) : !pairSelected ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
          Select a pair to view AMM pool info
        </p>
      ) : !pool || !pool.exists ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
          No AMM pool exists for this pair
        </p>
      ) : new BigNumber(pool.lpTokenValue).isZero() ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
          Pool is empty — all liquidity has been withdrawn
        </p>
      ) : (
        <PoolDetails pool={pool} baseCurrency={baseCurrency!} quoteCurrency={quoteCurrency!} />
      )}
    </div>
  );
}

function PoolDetails({
  pool,
  baseCurrency,
  quoteCurrency,
}: {
  pool: AmmPoolInfo;
  baseCurrency: string;
  quoteCurrency: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      {/* Frozen warnings */}
      {pool.asset1Frozen && (
        <div className="bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {baseCurrency} is frozen by its issuer
        </div>
      )}
      {pool.asset2Frozen && (
        <div className="bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {quoteCurrency} is frozen by its issuer
        </div>
      )}

      {/* Spot Price */}
      <Row
        label="Spot Price"
        value={`${new BigNumber(pool.spotPrice).toFixed(6)} ${quoteCurrency}/${baseCurrency}`}
      />

      {/* Reserves */}
      <Row label={`${baseCurrency} Reserve`} value={new BigNumber(pool.asset1Value).toFormat(4)} />
      <Row label={`${quoteCurrency} Reserve`} value={new BigNumber(pool.asset2Value).toFormat(4)} />

      {/* LP Tokens */}
      <Row label="LP Tokens" value={new BigNumber(pool.lpTokenValue).toFormat(4)} />

      {/* Trading Fee */}
      <Row label="Trading Fee" value={formatAmmFee(pool.tradingFee)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-700 dark:text-zinc-300">{value}</span>
    </div>
  );
}
