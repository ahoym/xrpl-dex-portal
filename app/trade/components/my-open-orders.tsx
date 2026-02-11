"use client";

import { useState } from "react";
import type { OrderBookAmount } from "@/lib/types";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { fromRippleEpoch } from "@/lib/xrpl/constants";
import { cardClass } from "@/lib/ui/ui";

interface AccountOffer {
  seq: number;
  flags: number;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  expiration?: number;
}

interface MyOpenOrdersProps {
  offers: AccountOffer[];
  loading: boolean;
  pairSelected: boolean;
  baseCurrency?: string;
  quoteCurrency?: string;
  cancellingSeq: number | null;
  onCancel: (seq: number) => void;
}

function formatOfferSide(amt: OrderBookAmount): string {
  const cur = decodeCurrency(amt.currency);
  return `${parseFloat(amt.value).toFixed(4)} ${cur}`;
}

export function MyOpenOrders({
  offers,
  loading,
  pairSelected,
  baseCurrency,
  quoteCurrency,
  cancellingSeq,
  onCancel,
}: MyOpenOrdersProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cardClass}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          My Open Orders
          {pairSelected && !loading && (
            <span className="ml-1.5 text-sm font-normal text-zinc-400 dark:text-zinc-500">
              ({offers.length})
            </span>
          )}
          {pairSelected && baseCurrency && quoteCurrency && (
            <span className="ml-2 text-sm font-normal text-zinc-400 dark:text-zinc-500">
              {baseCurrency}/{quoteCurrency}
            </span>
          )}
        </h3>
        <span className="text-zinc-400 dark:text-zinc-500 text-sm">
          {collapsed ? "+" : "\u2212"}
        </span>
      </button>

      {!collapsed && (
        <>
          {loading ? (
            <div className="mt-4 space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
              ))}
            </div>
          ) : !pairSelected ? (
            <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
              Select a pair to see your offers
            </p>
          ) : offers.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
              No open orders for this pair
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {offers.map((offer) => {
                const getsLabel = formatOfferSide(offer.taker_gets);
                const paysLabel = formatOfferSide(offer.taker_pays);
                return (
                  <div
                    key={offer.seq}
                    className="flex items-center justify-between border border-zinc-100 bg-zinc-50/50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div className="text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="font-semibold">#{offer.seq}</span>
                      <span className="mx-2 text-zinc-300 dark:text-zinc-600">|</span>
                      Give {getsLabel}
                      <span className="mx-1.5 text-zinc-400 dark:text-zinc-500">for</span>
                      {paysLabel}
                    </div>
                    <div className="flex items-center gap-2">
                      {offer.expiration != null && (
                        <span className="group/exp relative flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="h-3.5 w-3.5 cursor-help text-amber-500 dark:text-amber-400"
                          >
                            <path fillRule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7.75-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5h-2.5v-3.5Z" clipRule="evenodd" />
                          </svg>
                          <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg group-hover/exp:block dark:bg-zinc-700">
                            Expires: {fromRippleEpoch(offer.expiration).toLocaleString()}
                          </span>
                        </span>
                      )}
                    <button
                      onClick={() => onCancel(offer.seq)}
                      disabled={cancellingSeq !== null}
                      className="border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 active:scale-[0.98] dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      {cancellingSeq === offer.seq
                        ? "Cancelling..."
                        : "Cancel"}
                    </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
