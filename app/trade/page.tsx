"use client";

import { useState, useCallback, useEffect } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useTradingData } from "@/lib/hooks/use-trading-data";
import { CustomCurrencyForm } from "./components/custom-currency-form";
import { CurrencyPairSelector } from "./components/currency-pair-selector";
import { TradeGrid } from "./components/trade-grid";
import { LoadingScreen } from "../components/loading-screen";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";
import { DEPTH_OPTIONS } from "./components/order-book";

export default function TradePage() {
  const { state, hydrated } = useAppState();

  const [sellingValue, setSellingValue] = useState("");
  const [buyingValue, setBuyingValue] = useState("");
  const [customCurrencies, setCustomCurrencies] = useState<
    { currency: string; issuer: string }[]
  >([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [depth, setDepth] = useState<number>(DEPTH_OPTIONS[1]);

  // Set default pair based on network — RLUSD/XRP when available, XRP otherwise
  useEffect(() => {
    if (!hydrated) return;
    const rlusdIssuer = WELL_KNOWN_CURRENCIES[state.network]?.RLUSD;
    if (rlusdIssuer) {
      setSellingValue(`${Assets.RLUSD}|${rlusdIssuer}`);
      setBuyingValue(`${Assets.XRP}|`);
    } else {
      setSellingValue(`${Assets.XRP}|`);
      setBuyingValue("");
    }
  }, [hydrated, state.network]);

  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const focusedWallet = state.wallet;

  // Trading data hook
  const {
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
  } = useTradingData({
    address: focusedWallet?.address,
    sellingValue,
    buyingValue,
    refreshKey,
    customCurrencies,
    depth,
  });

  if (!hydrated) {
    return <LoadingScreen />;
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Trade</h1>

      <CurrencyPairSelector
        sellingValue={sellingValue}
        buyingValue={buyingValue}
        currencyOptions={currencyOptions}
        onSellingChange={setSellingValue}
        onBuyingChange={setBuyingValue}
        onToggleCustomForm={() => setShowCustomForm(!showCustomForm)}
      />

      {showCustomForm && (
        <CustomCurrencyForm
          onAdd={(currency, issuer) =>
            setCustomCurrencies((prev) => [...prev, { currency, issuer }])
          }
          onClose={() => setShowCustomForm(false)}
        />
      )}

      <TradeGrid
        focusedWallet={focusedWallet}
        sellingCurrency={sellingCurrency}
        buyingCurrency={buyingCurrency}
        orderBook={orderBook}
        loadingOrderBook={loadingOrderBook}
        accountOffers={accountOffers}
        loadingOffers={loadingOffers}
        recentTrades={recentTrades}
        loadingTrades={loadingTrades}
        balances={balances}
        loadingBalances={loadingBalances}
        network={state.network}
        onRefresh={onRefresh}
        depth={depth}
        onDepthChange={setDepth}
        depthSummary={depthSummary}
      />

    </div>
  );
}
