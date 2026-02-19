"use client";

import { useState, useCallback, useEffect, useMemo, Suspense } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useWalletAdapter } from "@/lib/hooks/use-wallet-adapter";
import { useTradingData } from "@/lib/hooks/use-trading-data";
import { useDomainMode } from "@/lib/hooks/use-domain-mode";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { CustomCurrencyForm } from "./components/custom-currency-form";
import { CurrencyPairSelector } from "./components/currency-pair-selector";
import { DomainSelector } from "./components/domain-selector";
import { TradeGrid } from "./components/trade-grid";
import { OrdersSheet, OrdersSection } from "./components/orders-sheet";
import { LoadingScreen } from "../components/loading-screen";
import { Assets, WELL_KNOWN_CURRENCIES } from "@/lib/assets";
import { DEPTH_OPTIONS } from "./components/order-book";

export default function TradePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <TradePageInner />
    </Suspense>
  );
}

function TradePageInner() {
  const { state, hydrated } = useAppState();
  const { cancelOffer: adapterCancelOffer } = useWalletAdapter();
  const {
    domainID,
    setDomainID,
    clearDomain,
    enabled: domainEnabled,
    setEnabled: setDomainEnabled,
    expanded,
    setExpanded,
    isActive: domainActive,
  } = useDomainMode();

  const [sellingValue, setSellingValue] = useState("");
  const [buyingValue, setBuyingValue] = useState("");
  const [customCurrencies, setCustomCurrencies] = useState<{ currency: string; issuer: string }[]>(
    [],
  );
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
    filledOrders,
    loadingFilledOrders,
  } = useTradingData({
    address: focusedWallet?.address,
    sellingValue,
    buyingValue,
    refreshKey,
    customCurrencies,
    activeDomainID: domainActive ? domainID! : undefined,
  });

  // Filter offers to selected pair (shared by TradeGrid + OrdersSheet)
  // Shows ALL user offers for the pair regardless of domain — these are the user's own orders.
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
      return (getsMatchesSelling && paysMatchesBuying) || (getsMatchesBuying && paysMatchesSelling);
    });
  }, [accountOffers, sellingCurrency, buyingCurrency]);

  // Cancel offer handler (shared by TradeGrid + OrdersSheet)
  const [cancellingSeq, setCancellingSeq] = useState<number | null>(null);
  const handleCancel = useCallback(
    async (seq: number) => {
      if (!focusedWallet || cancellingSeq !== null) return;
      setCancellingSeq(seq);
      try {
        await adapterCancelOffer({ offerSequence: seq, network: state.network });
        onRefresh();
      } catch {
        // ignore
      } finally {
        setCancellingSeq(null);
      }
    },
    [focusedWallet, cancellingSeq, state.network, onRefresh, adapterCancelOffer],
  );

  if (!hydrated) {
    return <LoadingScreen />;
  }

  const pairSelected = sellingCurrency !== null && buyingCurrency !== null;

  const ordersProps = {
    openOrders: pairOffers,
    loadingOpen: loadingOffers,
    filledOrders,
    loadingFilled: loadingFilledOrders,
    pairSelected,
    baseCurrency: sellingCurrency?.currency,
    baseIssuer: sellingCurrency?.issuer,
    quoteCurrency: buyingCurrency?.currency,
    cancellingSeq,
    onCancel: handleCancel,
    activeDomainID: domainActive ? domainID! : undefined,
  };

  return (
    <div className="px-4 py-6 lg:pb-[calc(33vh+1.5rem)]">
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

      <DomainSelector
        domainID={domainID}
        onDomainChange={setDomainID}
        onClear={clearDomain}
        enabled={domainEnabled}
        onToggleEnabled={setDomainEnabled}
        expanded={expanded}
        onToggleExpanded={setExpanded}
        isActive={domainActive}
      />

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
        activeDomainID={domainActive ? domainID! : undefined}
      />

      {/* Mobile: in-flow orders section */}
      {focusedWallet && (
        <div className="mt-5 lg:hidden">
          <OrdersSection {...ordersProps} />
        </div>
      )}

      {/* Desktop: fixed bottom sheet */}
      {focusedWallet && <OrdersSheet {...ordersProps} />}
    </div>
  );
}
