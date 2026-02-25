"use client";

import type { BalanceEntry } from "@/lib/types";
import BigNumber from "bignumber.js";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { isLpTokenCurrency, formatLpTokenLabel } from "@/lib/xrpl/lp-token";
import { cardClass } from "@/lib/ui/ui";

interface BalancesPanelProps {
  balances: BalanceEntry[];
  loading: boolean;
  onRefresh?: () => void;
}

export function BalancesPanel({ balances, loading, onRefresh }: BalancesPanelProps) {
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Balances
        </h3>
        {onRefresh && (
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
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-16 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-20 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      ) : balances.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          No balances
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {balances.map((b, i) => {
            const cur = isLpTokenCurrency(b.currency)
              ? formatLpTokenLabel()
              : decodeCurrency(b.currency);
            return (
              <div
                key={i}
                className="flex items-center justify-between px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {cur}
                </span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">
                  {new BigNumber(b.value).toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
