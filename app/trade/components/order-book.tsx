"use client";

import { useState } from "react";
import BigNumber from "bignumber.js";
import type { OrderBookEntry } from "@/lib/types";
import { matchesCurrency } from "@/lib/xrpl/match-currency";

/** Client-side depth options. Server returns up to DEFAULT_ORDERBOOK_LIMIT (50); hard max is MAX_API_LIMIT (400). */
const DEPTH_OPTIONS = [10, 25, 50] as const;

interface OrderBookProps {
  orderBook: { buy: OrderBookEntry[]; sell: OrderBookEntry[] } | null;
  loading: boolean;
  baseCurrency: string;
  baseIssuer?: string;
  quoteCurrency: string;
  accountAddress?: string;
  onSelectOrder?: (price: string, amount: string, tab: "buy" | "sell") => void;
}

export function OrderBook({
  orderBook,
  loading,
  baseCurrency,
  baseIssuer,
  quoteCurrency,
  accountAddress,
  onSelectOrder,
}: OrderBookProps) {
  const [depth, setDepth] = useState<number>(DEPTH_OPTIONS[1]);

  const allOffers = [
    ...(orderBook?.buy ?? []),
    ...(orderBook?.sell ?? []),
  ];

  // Asks: creator sells base (taker_gets = base)
  const asks = allOffers
    .filter((o) => matchesCurrency(o.taker_gets, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = new BigNumber(o.taker_gets.value);
      const total = new BigNumber(o.taker_pays.value);
      const price = amount.gt(0) ? total.div(amount) : new BigNumber(0);
      return { price, amount, total, account: o.account };
    });
  asks.sort((a, b) => b.price.comparedTo(a.price) ?? 0);

  // Bids: creator buys base (taker_pays = base, taker_gets = quote)
  const bids = allOffers
    .filter((o) => matchesCurrency(o.taker_pays, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = new BigNumber(o.taker_pays.value);
      const total = new BigNumber(o.taker_gets.value);
      const price = amount.gt(0) ? total.div(amount) : new BigNumber(0);
      return { price, amount, total, account: o.account };
    });
  bids.sort((a, b) => b.price.comparedTo(a.price) ?? 0);

  const visibleAsks = asks.slice(-depth);
  const visibleBids = bids.slice(0, depth);

  const askCumulative: BigNumber[] = [];
  for (let i = visibleAsks.length - 1, cum = new BigNumber(0); i >= 0; i--) {
    cum = cum.plus(visibleAsks[i].amount);
    askCumulative[i] = cum;
  }
  const bidCumulative: BigNumber[] = [];
  for (let i = 0, cum = new BigNumber(0); i < visibleBids.length; i++) {
    cum = cum.plus(visibleBids[i].amount);
    bidCumulative[i] = cum;
  }

  const maxAmount = BigNumber.max(
    ...visibleAsks.map((a) => a.amount),
    ...visibleBids.map((b) => b.amount),
    0,
  );

  const bestAsk = visibleAsks.length > 0 ? visibleAsks[visibleAsks.length - 1].price : null;
  const bestBid = visibleBids.length > 0 ? visibleBids[0].price : null;
  const spread = bestAsk !== null && bestBid !== null ? bestAsk.minus(bestBid) : null;
  const mid = bestAsk !== null && bestBid !== null ? bestAsk.plus(bestBid).div(2) : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Order Book
        </h3>
        <select
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {DEPTH_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-4 border-b border-zinc-200 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
          <span className="text-right">Depth</span>
        </div>

        <div className="mb-1 mt-2.5 text-[10px] font-bold uppercase tracking-widest text-red-400 dark:text-red-500">
          Asks
        </div>
        {visibleAsks.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No asks
          </p>
        ) : (
          visibleAsks.map((a, i) => {
            const isOwn = accountAddress !== undefined && a.account === accountAddress;
            const clickable = !isOwn && onSelectOrder;
            const barPct = maxAmount.gt(0) ? a.amount.div(maxAmount).times(100).toNumber() : 0;
            return (
              <div
                key={`ask-${i}`}
                onClick={clickable ? () => onSelectOrder(a.price.toFixed(6), a.amount.toFixed(6), "buy") : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onSelectOrder(a.price.toFixed(6), a.amount.toFixed(6), "buy"); } : undefined}
                className={`relative grid grid-cols-4 py-0.5 text-xs font-mono ${
                  clickable
                    ? "cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                    : isOwn
                      ? "opacity-40"
                      : ""
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 bg-red-100/60 dark:bg-red-900/20"
                  style={{ width: `${barPct}%` }}
                />
                <span className="relative font-semibold text-red-600 dark:text-red-400">
                  {a.price.toFixed(6)}
                </span>
                <span className="relative text-right text-zinc-700 dark:text-zinc-300">
                  {a.amount.toFixed(4)}
                </span>
                <span className="relative text-right text-zinc-500 dark:text-zinc-400">
                  {a.total.toFixed(4)}
                </span>
                <span className="relative text-right text-zinc-500 dark:text-zinc-400">
                  {askCumulative[i].toFixed(4)}
                </span>
              </div>
            );
          })
        )}

        <div className="my-2 border border-dashed border-zinc-200 bg-zinc-50/50 py-2 text-center text-xs dark:border-zinc-700 dark:bg-zinc-800/30">
          {spread !== null && mid !== null ? (
            <span className="text-zinc-600 dark:text-zinc-300">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{mid.toFixed(6)}</span>
              <span className="mx-2 text-zinc-300 dark:text-zinc-600">|</span>
              <span className="text-zinc-400 dark:text-zinc-500">
                Spread: {spread.toFixed(6)}{" "}
                ({new BigNumber(spread).div(mid).times(10_000).toFixed(1)} bps)
              </span>
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">
              {bestAsk !== null ? `Best ask: ${bestAsk.toFixed(6)}` : bestBid !== null ? `Best bid: ${bestBid.toFixed(6)}` : "No orders"}
            </span>
          )}
        </div>

        <div className="mb-1 mt-2.5 text-[10px] font-bold uppercase tracking-widest text-green-500 dark:text-green-500">
          Bids
        </div>
        {visibleBids.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No bids
          </p>
        ) : (
          visibleBids.map((b, i) => {
            const isOwn = accountAddress !== undefined && b.account === accountAddress;
            const clickable = !isOwn && onSelectOrder;
            const barPct = maxAmount.gt(0) ? b.amount.div(maxAmount).times(100).toNumber() : 0;
            return (
              <div
                key={`bid-${i}`}
                onClick={clickable ? () => onSelectOrder(b.price.toFixed(6), b.amount.toFixed(6), "sell") : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onSelectOrder(b.price.toFixed(6), b.amount.toFixed(6), "sell"); } : undefined}
                className={`relative grid grid-cols-4 py-0.5 text-xs font-mono ${
                  clickable
                    ? "cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20"
                    : isOwn
                      ? "opacity-40"
                      : ""
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 bg-green-100/60 dark:bg-green-900/20"
                  style={{ width: `${barPct}%` }}
                />
                <span className="relative font-semibold text-green-600 dark:text-green-400">
                  {b.price.toFixed(6)}
                </span>
                <span className="relative text-right text-zinc-700 dark:text-zinc-300">
                  {b.amount.toFixed(4)}
                </span>
                <span className="relative text-right text-zinc-500 dark:text-zinc-400">
                  {b.total.toFixed(4)}
                </span>
                <span className="relative text-right text-zinc-500 dark:text-zinc-400">
                  {bidCumulative[i].toFixed(4)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
