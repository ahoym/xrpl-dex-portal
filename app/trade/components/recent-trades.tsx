"use client";

import BigNumber from "bignumber.js";
import { useAppState } from "@/lib/hooks/use-app-state";
import { EXPLORER_URLS } from "@/lib/xrpl/networks";
import { cardClass } from "@/lib/ui/ui";
import { formatTime, formatDateTime } from "@/lib/ui/format-time";

export interface RecentTrade {
  side: "buy" | "sell";
  price: string;
  baseAmount: string;
  quoteAmount: string;
  account: string;
  time: string;
  hash: string;
}

interface RecentTradesProps {
  trades: RecentTrade[];
  loading: boolean;
  pairSelected: boolean;
  baseCurrency?: string;
  quoteCurrency?: string;
  activeDomainID?: string;
}

export function RecentTrades({
  trades,
  loading,
  pairSelected,
  baseCurrency,
  quoteCurrency,
  activeDomainID,
}: RecentTradesProps) {
  const { state } = useAppState();
  const explorerBase = EXPLORER_URLS[state.network];

  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Recent Trades
        {pairSelected && baseCurrency && quoteCurrency && (
          <span className="ml-2 text-sm font-normal text-zinc-400 dark:text-zinc-500">
            {baseCurrency}/{quoteCurrency}
          </span>
        )}
      </h3>
      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
          ))}
        </div>
      ) : !pairSelected ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
          Select a pair to see recent trades
        </p>
      ) : trades.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
          {activeDomainID
            ? "No recent trades in this permissioned domain"
            : "No recent trades for this pair"}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                <th className="pb-2 pr-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Side
                </th>
                <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Price
                </th>
                <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Amount
                </th>
                <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Total
                </th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr
                  key={trade.hash}
                  className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  onClick={() =>
                    window.open(
                      `${explorerBase}/transactions/${trade.hash}`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <td className="py-2 pr-2">
                    <span
                      className={
                        trade.side === "buy"
                          ? "font-semibold text-green-600 dark:text-green-400"
                          : "font-semibold text-red-600 dark:text-red-400"
                      }
                    >
                      {trade.side === "buy" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {new BigNumber(trade.price).toFixed(4)}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {new BigNumber(trade.baseAmount).toFixed(4)}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {new BigNumber(trade.quoteAmount).toFixed(4)}
                  </td>
                  <td className="py-2 text-right text-zinc-500 dark:text-zinc-400">
                    <span className="group relative cursor-default">
                      {formatTime(trade.time)}
                      <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap bg-zinc-800 px-2.5 py-1 text-xs text-white shadow-lg group-hover:block dark:bg-zinc-700">
                        {formatDateTime(trade.time)}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
