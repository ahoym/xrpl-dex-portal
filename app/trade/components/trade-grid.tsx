"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { OrderBook } from "./order-book";
import { TradeForm } from "./trade-form";
import { MyOpenOrders } from "./my-open-orders";
import { RecentTrades } from "./recent-trades";
import { BalancesPanel } from "./balances-panel";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import type { TradeFormPrefill } from "./trade-form";
import type { WalletInfo, BalanceEntry, DepthSummary } from "@/lib/types";
import type { CurrencyOption, OrderBookData, AccountOffer } from "@/lib/hooks/use-trading-data";
import type { RecentTrade } from "./recent-trades";
import { cardClass } from "@/lib/ui/ui";

interface TradeGridProps {
  focusedWallet: WalletInfo | null;
  sellingCurrency: CurrencyOption | null;
  buyingCurrency: CurrencyOption | null;
  orderBook: OrderBookData | null;
  loadingOrderBook: boolean;
  accountOffers: AccountOffer[];
  loadingOffers: boolean;
  recentTrades: RecentTrade[];
  loadingTrades: boolean;
  balances: BalanceEntry[];
  loadingBalances: boolean;
  network: string;
  onRefresh: () => void;
  depth: number;
  onDepthChange: (d: number) => void;
  depthSummary: DepthSummary | null;
}

export function TradeGrid({
  focusedWallet,
  sellingCurrency,
  buyingCurrency,
  orderBook,
  loadingOrderBook,
  accountOffers,
  loadingOffers,
  recentTrades,
  loadingTrades,
  balances,
  loadingBalances,
  network,
  onRefresh,
  depth,
  onDepthChange,
  depthSummary,
}: TradeGridProps) {
  const [cancellingSeq, setCancellingSeq] = useState<number | null>(null);
  const [prefill, setPrefill] = useState<TradeFormPrefill | undefined>(undefined);
  const prefillKeyRef = useRef(0);

  const pairSelected = sellingCurrency !== null && buyingCurrency !== null;

  // Filter offers to the selected pair
  const pairOffers = useMemo(() => {
    if (!sellingCurrency || !buyingCurrency) return [];
    return accountOffers.filter((o) => {
      const getsMatchesSelling = matchesCurrency(
        o.taker_gets,
        sellingCurrency.currency,
        sellingCurrency.issuer,
      );
      const paysMatchesBuying = matchesCurrency(
        o.taker_pays,
        buyingCurrency.currency,
        buyingCurrency.issuer,
      );
      const getsMatchesBuying = matchesCurrency(
        o.taker_gets,
        buyingCurrency.currency,
        buyingCurrency.issuer,
      );
      const paysMatchesSelling = matchesCurrency(
        o.taker_pays,
        sellingCurrency.currency,
        sellingCurrency.issuer,
      );
      return (
        (getsMatchesSelling && paysMatchesBuying) ||
        (getsMatchesBuying && paysMatchesSelling)
      );
    });
  }, [accountOffers, sellingCurrency, buyingCurrency]);

  // Cancel an offer
  const handleCancel = useCallback(
    async (seq: number) => {
      if (!focusedWallet || cancellingSeq !== null) return;
      setCancellingSeq(seq);
      try {
        const res = await fetch("/api/dex/offers/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed: focusedWallet.seed,
            offerSequence: seq,
            network,
          }),
        });
        if (res.ok) {
          onRefresh();
        }
      } catch {
        // ignore
      } finally {
        setCancellingSeq(null);
      }
    },
    [focusedWallet, cancellingSeq, network, onRefresh],
  );

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-7">
      {/* Left column: Recent Trades */}
      <div className="space-y-5 lg:col-span-2">
        <RecentTrades
          trades={recentTrades}
          loading={loadingTrades}
          pairSelected={pairSelected}
          baseCurrency={sellingCurrency?.currency}
          quoteCurrency={buyingCurrency?.currency}
        />
      </div>

      {/* Middle column: Order Book + My Open Orders */}
      <div className="space-y-5 lg:col-span-3">
        <div className={cardClass}>
          {pairSelected ? (
            <OrderBook
              orderBook={orderBook}
              loading={loadingOrderBook}
              baseCurrency={sellingCurrency!.currency}
              baseIssuer={sellingCurrency!.issuer}
              quoteCurrency={buyingCurrency!.currency}
              accountAddress={focusedWallet?.address}
              depth={depth}
              onDepthChange={onDepthChange}
              depthSummary={depthSummary}
              onSelectOrder={(price, amount, tab) => {
                prefillKeyRef.current += 1;
                setPrefill({ price, amount, tab, key: prefillKeyRef.current });
              }}
            />
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Select a currency pair to view the order book
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Right column: Balances + My Open Orders + Trade Form */}
      <div className="space-y-5 lg:col-span-2">
        {focusedWallet && (
          <BalancesPanel balances={balances} loading={loadingBalances} onRefresh={onRefresh} />
        )}

        {focusedWallet && (
          <MyOpenOrders
            offers={pairOffers}
            loading={loadingOffers}
            pairSelected={pairSelected}
            baseCurrency={sellingCurrency?.currency}
            quoteCurrency={buyingCurrency?.currency}
            cancellingSeq={cancellingSeq}
            onCancel={handleCancel}
          />
        )}

        <div className={cardClass}>
          {pairSelected && focusedWallet ? (
            <TradeForm
              focusedWallet={focusedWallet}
              sellingCurrency={sellingCurrency!}
              buyingCurrency={buyingCurrency!}
              balances={balances}
              prefill={prefill}
              onSubmitted={onRefresh}
            />
          ) : !focusedWallet ? (
            <div className="py-12 text-center">
              <a
                href="/setup"
                className="text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Set up a wallet to place orders
              </a>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Select a currency pair to place orders
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
