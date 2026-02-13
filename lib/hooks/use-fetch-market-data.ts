"use client";

import { useState, useEffect, useCallback } from "react";
import type { DepthSummary } from "@/lib/types";
import type { RecentTrade } from "@/app/trade/components/recent-trades";
import type { CurrencyOption, OrderBookData } from "./use-trading-data";

/**
 * Fetches and manages market data state (order book, recent trades, depth
 * summary) for a given currency pair.
 *
 * Triggers an initial fetch when currencies/network/refreshKey change.
 * Returns a `fetchSilent` callback for the poller to call without setting
 * loading states.
 */
export function useFetchMarketData(
  sellingCurrency: CurrencyOption | null,
  buyingCurrency: CurrencyOption | null,
  network: string,
  refreshKey: number,
) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [loadingOrderBook, setLoadingOrderBook] = useState(false);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [depthSummary, setDepthSummary] = useState<DepthSummary | null>(null);

  const fetchMarketData = useCallback(
    async (selling: CurrencyOption, buying: CurrencyOption, net: string, silent = false) => {
      if (!silent) {
        setLoadingOrderBook(true);
        setLoadingTrades(true);
      }
      try {
        const params = new URLSearchParams({
          base_currency: selling.currency,
          quote_currency: buying.currency,
          network: net,
        });
        if (selling.issuer) params.set("base_issuer", selling.issuer);
        if (buying.issuer) params.set("quote_issuer", buying.issuer);

        const res = await fetch(`/api/dex/market-data?${params}`);
        const data = await res.json();
        if (res.ok) {
          if (data.orderbook != null) {
            setOrderBook({ buy: data.orderbook.buy ?? [], sell: data.orderbook.sell ?? [] });
          } else if (!silent) {
            setOrderBook(null);
          }
          if (data.depth != null) {
            setDepthSummary(data.depth);
          } else if (!silent) {
            setDepthSummary(null);
          }
          if (data.trades != null) {
            setRecentTrades(data.trades);
          } else if (!silent) {
            setRecentTrades([]);
          }
        } else if (!silent) {
          setOrderBook(null);
          setRecentTrades([]);
        }
      } catch {
        if (!silent) {
          setOrderBook(null);
          setRecentTrades([]);
        }
      } finally {
        if (!silent) {
          setLoadingOrderBook(false);
          setLoadingTrades(false);
        }
      }
    },
    [],
  );

  // Initial fetch + re-fetch on currency/network/refreshKey change
  useEffect(() => {
    if (!sellingCurrency || !buyingCurrency) return;
    fetchMarketData(sellingCurrency, buyingCurrency, network);
  }, [sellingCurrency, buyingCurrency, network, refreshKey, fetchMarketData]);

  // Stable callback for the poller (always uses latest currencies/network)
  const fetchSilent = useCallback(async () => {
    if (!sellingCurrency || !buyingCurrency) return;
    await fetchMarketData(sellingCurrency, buyingCurrency, network, true);
  }, [sellingCurrency, buyingCurrency, network, fetchMarketData]);

  return {
    orderBook,
    loadingOrderBook,
    recentTrades,
    loadingTrades,
    depthSummary,
    fetchSilent,
  };
}
