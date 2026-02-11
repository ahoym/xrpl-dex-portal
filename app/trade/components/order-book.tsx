"use client";

import type { OrderBookEntry } from "@/lib/types";
import { matchesCurrency } from "@/lib/xrpl/match-currency";

interface OrderBookProps {
  orderBook: { buy: OrderBookEntry[]; sell: OrderBookEntry[] } | null;
  loading: boolean;
  baseCurrency: string;
  baseIssuer?: string;
  quoteCurrency: string;
  accountAddress?: string;
  onRefresh: () => void;
  onSelectOrder?: (price: string, amount: string, tab: "buy" | "sell") => void;
}

export function OrderBook({
  orderBook,
  loading,
  baseCurrency,
  baseIssuer,
  quoteCurrency,
  accountAddress,
  onRefresh,
  onSelectOrder,
}: OrderBookProps) {
  const allOffers = [
    ...(orderBook?.buy ?? []),
    ...(orderBook?.sell ?? []),
  ];

  // Asks: creator sells base (taker_gets = base)
  const asks = allOffers
    .filter((o) => matchesCurrency(o.taker_gets, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = parseFloat(o.taker_gets.value);
      const total = parseFloat(o.taker_pays.value);
      const price = amount > 0 ? total / amount : 0;
      return { price, amount, total, account: o.account };
    });
  asks.sort((a, b) => b.price - a.price);

  // Bids: creator buys base (taker_pays = base, taker_gets = quote)
  const bids = allOffers
    .filter((o) => matchesCurrency(o.taker_pays, baseCurrency, baseIssuer))
    .map((o) => {
      const amount = parseFloat(o.taker_pays.value);
      const total = parseFloat(o.taker_gets.value);
      const price = amount > 0 ? total / amount : 0;
      return { price, amount, total, account: o.account };
    });
  bids.sort((a, b) => b.price - a.price);

  const askCumulative: number[] = new Array(asks.length);
  for (let i = asks.length - 1, cum = 0; i >= 0; i--) {
    cum += asks[i].amount;
    askCumulative[i] = cum;
  }
  const bidCumulative: number[] = new Array(bids.length);
  for (let i = 0, cum = 0; i < bids.length; i++) {
    cum += bids[i].amount;
    bidCumulative[i] = cum;
  }

  const maxAmount = Math.max(
    ...asks.map((a) => a.amount),
    ...bids.map((b) => b.amount),
    0,
  );

  const bestAsk = asks.length > 0 ? asks[asks.length - 1].price : null;
  const bestBid = bids.length > 0 ? bids[0].price : null;
  const spread = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null;
  const mid = bestAsk !== null && bestBid !== null ? (bestAsk + bestBid) / 2 : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Order Book
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-4 border-b border-zinc-200 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
          <span>Price</span>
          <span className="text-right">{baseCurrency}</span>
          <span className="text-right">{quoteCurrency}</span>
          <span className="text-right">Depth</span>
        </div>

        <div className="mb-1 mt-2.5 text-[10px] font-bold uppercase tracking-widest text-red-400 dark:text-red-500">
          Asks
        </div>
        {asks.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No asks
          </p>
        ) : (
          asks.map((a, i) => {
            const isOwn = accountAddress !== undefined && a.account === accountAddress;
            const clickable = !isOwn && onSelectOrder;
            const barPct = maxAmount > 0 ? (a.amount / maxAmount) * 100 : 0;
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
                Spread: {spread.toFixed(6)}
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
        {bids.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No bids
          </p>
        ) : (
          bids.map((b, i) => {
            const isOwn = accountAddress !== undefined && b.account === accountAddress;
            const clickable = !isOwn && onSelectOrder;
            const barPct = maxAmount > 0 ? (b.amount / maxAmount) * 100 : 0;
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
