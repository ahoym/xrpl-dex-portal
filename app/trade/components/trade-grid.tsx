"use client";

import { useState, useRef } from "react";
import { OrderBook } from "./order-book";
import { TradeForm } from "./trade-form";
import { RecentTrades } from "./recent-trades";
import { BalancesPanel } from "./balances-panel";
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
  activeDomainID?: string;
}

export function TradeGrid({
  focusedWallet,
  sellingCurrency,
  buyingCurrency,
  orderBook,
  loadingOrderBook,
  recentTrades,
  loadingTrades,
  balances,
  loadingBalances,
  onRefresh,
  depth,
  onDepthChange,
  depthSummary,
  activeDomainID,
}: TradeGridProps) {
  const [prefill, setPrefill] = useState<TradeFormPrefill | undefined>(undefined);
  const prefillKeyRef = useRef(0);

  const pairSelected = sellingCurrency !== null && buyingCurrency !== null;
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
          activeDomainID={activeDomainID}
        />
      </div>

      {/* Middle column: Order Book */}
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
              activeDomainID={activeDomainID}
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

      {/* Right column: Balances + Trade Form */}
      <div className="space-y-5 lg:col-span-2">
        {focusedWallet && (
          <BalancesPanel balances={balances} loading={loadingBalances} onRefresh={onRefresh} />
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
              activeDomainID={activeDomainID}
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
