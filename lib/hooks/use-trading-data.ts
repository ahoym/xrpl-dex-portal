"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppState } from "./use-app-state";
import { useBalances } from "./use-balances";
import { usePollInterval } from "./use-poll-interval";
import { useOfferExpirationTimers } from "./use-offer-expiration-timers";
import { useFetchMarketData } from "./use-fetch-market-data";
import type { OrderBookAmount, OrderBookEntry, DepthSummary } from "@/lib/types";
import type { RecentTrade } from "@/app/trade/components/recent-trades";
import { parseFilledOrders } from "@/lib/xrpl/filled-orders";
import { buildCurrencyOptions, detectNewOwnTrades } from "./use-trading-data-utils";
import type { FilledOrder } from "@/lib/xrpl/filled-orders";

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
  domainID?: string;
}

interface UseTradingDataOptions {
  address: string | undefined;
  sellingValue: string;
  buyingValue: string;
  refreshKey: number;
  customCurrencies: { currency: string; issuer: string }[];
  activeDomainID?: string;
}

export function useTradingData({
  address,
  sellingValue,
  buyingValue,
  refreshKey,
  customCurrencies,
  activeDomainID,
}: UseTradingDataOptions) {
  const {
    state: { network },
  } = useAppState();
  const { balances, loading: loadingBalances } = useBalances(address, network, refreshKey);
  const seenTradeHashes = useRef(new Set<string>());

  const [accountOffers, setAccountOffers] = useState<AccountOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
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

  // Market data (delegated to focused hook)
  const { orderBook, loadingOrderBook, recentTrades, loadingTrades, depthSummary, fetchSilent } =
    useFetchMarketData(sellingCurrency, buyingCurrency, network, refreshKey, activeDomainID);

  // Polling (delegated to generic hook)
  const pollEnabled = sellingCurrency !== null && buyingCurrency !== null;
  usePollInterval(fetchSilent, POLL_INTERVAL_MS, pollEnabled);

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

  // Reactive fill detection: when a new recent trade matches our address, refresh open orders
  useEffect(() => {
    const { shouldRefresh } = detectNewOwnTrades(recentTrades, seenTradeHashes.current, address);
    if (shouldRefresh) {
      fetchAccountOffers(address!, network, true);
    }
  }, [recentTrades, address, network, fetchAccountOffers]);

  // Offer expiration timers (delegated to focused hook)
  const handleOfferExpire = useCallback(() => {
    if (address) fetchAccountOffers(address, network, true);
  }, [address, network, fetchAccountOffers]);

  useOfferExpirationTimers(address ? accountOffers : [], handleOfferExpire);

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
