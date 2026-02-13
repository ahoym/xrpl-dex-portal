"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppState } from "./use-app-state";
import { useBalances } from "./use-balances";
import { usePageVisible } from "./use-page-visible";
import type { OrderBookAmount, OrderBookEntry, DepthSummary } from "@/lib/types";
import type { RecentTrade } from "@/app/trade/components/recent-trades";
import { parseFilledOrders } from "@/lib/xrpl/filled-orders";
import { buildCurrencyOptions, detectNewOwnTrades } from "./use-trading-data-utils";
import type { FilledOrder } from "@/lib/xrpl/filled-orders";
import { fromRippleEpoch } from "@/lib/xrpl/constants";

const POLL_INTERVAL_MS = 3_000;

export interface CurrencyOption {
  currency: string;
  issuer?: string;
  label: string;
  value: string; // encoded as "currency|issuer"
}

export interface OrderBookData {
  buy: OrderBookEntry[];
  sell: OrderBookEntry[];
}

export interface AccountOffer {
  seq: number;
  flags: number;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  expiration?: number;
}

interface UseTradingDataOptions {
  address: string | undefined;
  sellingValue: string;
  buyingValue: string;
  refreshKey: number;
  customCurrencies: { currency: string; issuer: string }[];
}

export function useTradingData({
  address,
  sellingValue,
  buyingValue,
  refreshKey,
  customCurrencies,
}: UseTradingDataOptions) {
  const {
    state: { network },
  } = useAppState();
  const { balances, loading: loadingBalances } = useBalances(address, network, refreshKey);
  const visible = usePageVisible();
  const pollingMarketData = useRef(false);
  const seenTradeHashes = useRef(new Set<string>());

  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [loadingOrderBook, setLoadingOrderBook] = useState(false);
  const [accountOffers, setAccountOffers] = useState<AccountOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [depthSummary, setDepthSummary] = useState<DepthSummary | null>(null);
  const [filledOrders, setFilledOrders] = useState<FilledOrder[]>([]);
  const [loadingFilledOrders, setLoadingFilledOrders] = useState(false);

  // Build currency options from balances + well-known + custom
  const currencyOptions = useMemo<CurrencyOption[]>(
    () => buildCurrencyOptions(balances, customCurrencies, network),
    [balances, customCurrencies, network],
  );

  // Resolve selected currencies from string values
  const sellingCurrency = useMemo(
    () => currencyOptions.find((o) => o.value === sellingValue) ?? null,
    [currencyOptions, sellingValue],
  );
  const buyingCurrency = useMemo(
    () => currencyOptions.find((o) => o.value === buyingValue) ?? null,
    [currencyOptions, buyingValue],
  );

  // Fetch market data (orderbook + trades in one request)
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

  // Fetch account offers
  const fetchAccountOffers = useCallback(async (addr: string, net: string, silent = false) => {
    if (!silent) setLoadingOffers(true);
    try {
      const res = await fetch(`/api/accounts/${addr}/offers?network=${net}`);
      const data = await res.json();
      if (res.ok) {
        setAccountOffers(data.offers ?? []);
      } else if (!silent) {
        setAccountOffers([]);
      }
    } catch {
      if (!silent) setAccountOffers([]);
    } finally {
      if (!silent) setLoadingOffers(false);
    }
  }, []);

  useEffect(() => {
    if (address) {
      fetchAccountOffers(address, network);
    }
  }, [address, network, refreshKey, fetchAccountOffers]);

  useEffect(() => {
    if (!sellingCurrency || !buyingCurrency) return;
    fetchMarketData(sellingCurrency, buyingCurrency, network);

    if (!visible) return;
    const id = setInterval(() => {
      if (pollingMarketData.current) return;
      pollingMarketData.current = true;
      fetchMarketData(sellingCurrency, buyingCurrency, network, true).finally(() => {
        pollingMarketData.current = false;
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [sellingCurrency, buyingCurrency, network, refreshKey, visible, fetchMarketData]);

  // Reactive fill detection: when a new recent trade matches our address, refresh open orders
  useEffect(() => {
    const { shouldRefresh } = detectNewOwnTrades(
      recentTrades,
      seenTradeHashes.current,
      address,
    );
    if (shouldRefresh) {
      fetchAccountOffers(address!, network, true);
    }
  }, [recentTrades, address, network, fetchAccountOffers]);

  // Expiration tracking: schedule a refresh when an open order's expiration time is reached
  useEffect(() => {
    if (!address || accountOffers.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();

    for (const offer of accountOffers) {
      if (offer.expiration == null) continue;
      const expiresAt = fromRippleEpoch(offer.expiration).getTime();
      const delay = expiresAt - now;
      // Only schedule for offers that expire in the future (within 5 minutes).
      // Already-expired offers linger on-ledger; re-fetching them causes an
      // infinite loop because the response still includes them.
      if (delay > 0 && delay <= 5 * 60 * 1000) {
        const timer = setTimeout(
          () => fetchAccountOffers(address, network, true),
          delay + 1000, // 1s buffer after expiry
        );
        timers.push(timer);
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [accountOffers, address, network, fetchAccountOffers]);

  // Fetch filled orders from account transaction history
  const fetchFilledOrders = useCallback(
    async (addr: string, net: string, selling: CurrencyOption, buying: CurrencyOption) => {
      setLoadingFilledOrders(true);
      try {
        const res = await fetch(
          `/api/accounts/${encodeURIComponent(addr)}/transactions?network=${net}&limit=200`,
        );
        const data = await res.json();
        if (res.ok) {
          const txs = (data.transactions ?? []) as Record<string, unknown>[];
          setFilledOrders(
            parseFilledOrders(
              txs,
              addr,
              selling.currency,
              selling.issuer,
              buying.currency,
              buying.issuer,
            ),
          );
        } else {
          setFilledOrders([]);
        }
      } catch {
        setFilledOrders([]);
      } finally {
        setLoadingFilledOrders(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (address && sellingCurrency && buyingCurrency) {
      fetchFilledOrders(address, network, sellingCurrency, buyingCurrency);
    } else {
      setFilledOrders([]);
    }
  }, [address, network, sellingCurrency, buyingCurrency, refreshKey, fetchFilledOrders]);

  return {
    balances,
    loadingBalances,
    currencyOptions,
    sellingCurrency,
    buyingCurrency,
    orderBook,
    loadingOrderBook,
    accountOffers,
    loadingOffers,
    recentTrades,
    loadingTrades,
    depthSummary,
    filledOrders,
    loadingFilledOrders,
  };
}
