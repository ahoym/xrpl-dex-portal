"use client";

import { useState, useCallback } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useTradingData } from "@/lib/hooks/use-trading-data";
import { CustomCurrencyForm } from "./components/custom-currency-form";
import { CurrencyPairSelector } from "./components/currency-pair-selector";
import { TradeGrid } from "./components/trade-grid";
import { LoadingScreen } from "../components/loading-screen";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";

export default function TradePage() {
  const { state, hydrated } = useAppState();

  const [sellingValue, setSellingValue] = useState(`${Assets.RLUSD}|${WELL_KNOWN_CURRENCIES[state.network]?.RLUSD ?? ""}`);
  const [buyingValue, setBuyingValue] = useState(`${Assets.XRP}|`);
  const [customCurrencies, setCustomCurrencies] = useState<
    { currency: string; issuer: string }[]
  >([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
  } = useTradingData({
    address: focusedWallet?.address,
    sellingValue,
    buyingValue,
    refreshKey,
    customCurrencies,
  });

  if (!hydrated) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Trade</h1>

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
      />

    </div>
  );
}
