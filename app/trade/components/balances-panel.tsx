"use client";

import type { BalanceEntry } from "@/lib/types";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { cardClass } from "@/lib/ui/ui";

interface BalancesPanelProps {
  balances: BalanceEntry[];
  loading: boolean;
}

export function BalancesPanel({ balances, loading }: BalancesPanelProps) {
  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Balances
      </h3>
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
            const cur = decodeCurrency(b.currency);
            return (
              <div
                key={i}
                className="flex items-center justify-between px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {cur}
                </span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">
                  {parseFloat(b.value).toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
