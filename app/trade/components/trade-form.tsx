"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import BigNumber from "bignumber.js";
import type { WalletInfo, BalanceEntry, OrderBookEntry, AmmPoolInfo } from "@/lib/types";
import type { DomainAuthStatus } from "@/lib/hooks/use-domain-authorization";
import { useAppState } from "@/lib/hooks/use-app-state";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { useWalletAdapter } from "@/lib/hooks/use-wallet-adapter";
import { getSigningLoadingText, extractErrorMessage } from "@/lib/wallet-ui";
import type { OfferFlag } from "@/lib/xrpl/types";
import { toRippleEpoch } from "@/lib/xrpl/constants";
import { inputClass, labelClass, errorTextClass, SUCCESS_MESSAGE_DURATION_MS } from "@/lib/ui/ui";
import { CustomSelect } from "@/app/components/custom-select";
import { buildAsks, buildBids } from "@/lib/xrpl/order-book-levels";
import { estimateFillCombined } from "@/lib/xrpl/estimate-fill-combined";
import { buildAmmPoolParams } from "@/lib/xrpl/amm-math";

interface CurrencyOption {
  currency: string;
  issuer?: string;
  label: string;
}

export interface TradeFormPrefill {
  tab: "buy" | "sell";
  price: string;
  amount: string;
  key: number;
}

interface TradeFormProps {
  focusedWallet: WalletInfo;
  sellingCurrency: CurrencyOption;
  buyingCurrency: CurrencyOption;
  balances: BalanceEntry[];
  prefill?: TradeFormPrefill;
  onSubmitted: () => void;
  orderBook?: { buy: OrderBookEntry[]; sell: OrderBookEntry[] } | null;
  ammPool?: AmmPoolInfo | null;
  activeDomainID?: string;
  domainAuthStatus?: DomainAuthStatus;
  credentialExpiresAtMs?: number;
}

type ExecutionType = "" | "passive" | "immediateOrCancel" | "fillOrKill";

const EXECUTION_OPTIONS: { value: ExecutionType; label: string }[] = [
  { value: "", label: "Default (Limit)" },
  { value: "passive", label: "Passive" },
  { value: "immediateOrCancel", label: "Immediate or Cancel" },
  { value: "fillOrKill", label: "Fill or Kill" },
];

export function TradeForm({
  focusedWallet,
  sellingCurrency,
  buyingCurrency,
  balances,
  prefill,
  onSubmitted,
  orderBook,
  ammPool,
  activeDomainID,
  domainAuthStatus,
  credentialExpiresAtMs,
}: TradeFormProps) {
  const {
    state: { network },
  } = useAppState();
  const { adapter, createOffer: adapterCreateOffer } = useWalletAdapter();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [executionType, setExecutionType] = useState<ExecutionType>("");
  const [sellMode, setSellMode] = useState(false);
  const [hybridMode, setHybridMode] = useState(false);
  const [expiration, setExpiration] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const lastPrefillKey = useRef(prefill?.key);
  useEffect(() => {
    if (prefill && prefill.key !== lastPrefillKey.current) {
      lastPrefillKey.current = prefill.key;
      setTab(prefill.tab);
      setPrice(prefill.price);
      setAmount(prefill.amount);
      setError(null);
      setSuccess(false);
    }
  }, [prefill]);

  // Reset hybrid mode when domain context changes
  useEffect(() => {
    setHybridMode(false);
  }, [activeDomainID]);

  const total = amount && price ? new BigNumber(amount).times(new BigNumber(price)).toFixed(6) : "";

  const fillEstimate = useMemo(() => {
    if (!amount) return null;
    const parsedAmount = new BigNumber(amount);
    if (parsedAmount.isNaN() || parsedAmount.lte(0)) return null;

    const allOffers = [...(orderBook?.buy ?? []), ...(orderBook?.sell ?? [])];
    const asks = buildAsks(allOffers, sellingCurrency.currency, sellingCurrency.issuer);
    const bids = buildBids(allOffers, sellingCurrency.currency, sellingCurrency.issuer);

    const bestAsk = asks.length > 0 ? asks[asks.length - 1].price : null;
    const bestBid = bids.length > 0 ? bids[0].price : null;
    const mid = bestAsk && bestBid ? bestAsk.plus(bestBid).div(2) : null;

    // Buy: walk asks ascending (best ask first); Sell: walk bids descending (best bid first)
    const levels = tab === "buy" ? [...asks].reverse() : bids;
    const ammParams = buildAmmPoolParams(ammPool);

    return estimateFillCombined(levels, parsedAmount, mid, ammParams, tab);
  }, [orderBook, amount, tab, sellingCurrency, ammPool]);

  // Determine what currency and how much the user is spending
  const spendCurrency = tab === "buy" ? buyingCurrency : sellingCurrency;
  const spendAmount = tab === "buy" ? total : amount;

  const spendBalance = balances.find((b) =>
    matchesCurrency(b, spendCurrency.currency, spendCurrency.issuer),
  );
  const availableBalance = spendBalance ? new BigNumber(spendBalance.value) : new BigNumber(0);
  const insufficientBalance =
    spendAmount !== "" &&
    !new BigNumber(spendAmount).isNaN() &&
    new BigNumber(spendAmount).gt(0) &&
    new BigNumber(spendAmount).gt(availableBalance);

  const domainBlocked = activeDomainID !== undefined && domainAuthStatus === "unauthorized";

  const canSubmit =
    !submitting &&
    !insufficientBalance &&
    !domainBlocked &&
    amount !== "" &&
    !new BigNumber(amount).isNaN() &&
    new BigNumber(amount).gt(0) &&
    price !== "" &&
    !new BigNumber(price).isNaN() &&
    new BigNumber(price).gt(0);

  function buildFlags(): OfferFlag[] {
    const flags: OfferFlag[] = [];
    if (executionType) flags.push(executionType);
    if (sellMode) flags.push("sell");
    if (hybridMode && activeDomainID) flags.push("hybrid");
    return flags;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    let takerGets;
    let takerPays;

    if (tab === "buy") {
      takerGets =
        buyingCurrency.currency === "XRP"
          ? { currency: "XRP", value: total }
          : { currency: buyingCurrency.currency, issuer: buyingCurrency.issuer, value: total };
      takerPays =
        sellingCurrency.currency === "XRP"
          ? { currency: "XRP", value: amount }
          : { currency: sellingCurrency.currency, issuer: sellingCurrency.issuer, value: amount };
    } else {
      takerGets =
        sellingCurrency.currency === "XRP"
          ? { currency: "XRP", value: amount }
          : { currency: sellingCurrency.currency, issuer: sellingCurrency.issuer, value: amount };
      takerPays =
        buyingCurrency.currency === "XRP"
          ? { currency: "XRP", value: total }
          : { currency: buyingCurrency.currency, issuer: buyingCurrency.issuer, value: total };
    }

    const flags = buildFlags();
    const offerParams: Parameters<typeof adapterCreateOffer>[0] = {
      takerGets,
      takerPays,
      network,
    };

    if (flags.length > 0) {
      offerParams.flags = flags;
    }

    if (expiration) {
      const epochMs = new Date(expiration).getTime();
      if (!isNaN(epochMs)) {
        offerParams.expiration = toRippleEpoch(epochMs);
      }
    }

    if (activeDomainID) {
      offerParams.domainID = activeDomainID;
    }

    try {
      const result = await adapterCreateOffer(offerParams);
      if (!result.success) {
        setError(result.resultCode ?? "Failed to place offer");
      } else {
        setSuccess(true);
        setAmount("");
        setPrice("");
        setExecutionType("");
        setSellMode(false);
        setHybridMode(false);
        setExpiration("");
        setTimeout(() => {
          setSuccess(false);
          onSubmitted();
        }, SUCCESS_MESSAGE_DURATION_MS);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Place Order</h3>

      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => setTab("buy")}
          className={`flex-1 px-3 py-2 text-sm font-semibold ${
            tab === "buy"
              ? "bg-green-600 text-white shadow-sm dark:bg-green-700"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          Buy {sellingCurrency.currency}
        </button>
        <button
          type="button"
          onClick={() => setTab("sell")}
          className={`flex-1 px-3 py-2 text-sm font-semibold ${
            tab === "sell"
              ? "bg-red-600 text-white shadow-sm dark:bg-red-700"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          Sell {sellingCurrency.currency}
        </button>
      </div>

      {success ? (
        <div className="mt-4 bg-green-50 p-4 text-center text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Order placed successfully!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {activeDomainID && domainAuthStatus === "unauthorized" && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              Your wallet does not hold valid credentials for this permissioned domain.
            </div>
          )}
          {activeDomainID && domainAuthStatus === "loading" && (
            <div className="mb-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              Checking domain credentials…
            </div>
          )}
          {activeDomainID && domainAuthStatus === "error" && (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Could not verify domain credentials. Placing offers may fail.
            </div>
          )}
          {activeDomainID && domainAuthStatus === "authorized" && credentialExpiresAtMs && (
            <div className="mb-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              Your credential for this domain expires on{" "}
              {new Date(credentialExpiresAtMs).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              .
            </div>
          )}

          <div>
            <label className={labelClass}>Amount ({sellingCurrency.currency})</label>
            <input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Price ({buyingCurrency.currency} per {sellingCurrency.currency})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Total ({buyingCurrency.currency})</label>
            <div className="mt-1 border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
              {total || "—"}
            </div>
          </div>

          {amount && price && total && (
            <div className="bg-zinc-100 px-3 py-2.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {tab === "buy" ? (
                <>
                  Pay{" "}
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {total} {buyingCurrency.currency}
                  </span>{" "}
                  to receive{" "}
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {amount} {sellingCurrency.currency}
                  </span>
                </>
              ) : (
                <>
                  Sell{" "}
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {amount} {sellingCurrency.currency}
                  </span>{" "}
                  to receive{" "}
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {total} {buyingCurrency.currency}
                  </span>
                </>
              )}
            </div>
          )}

          {fillEstimate && (
            <div className="bg-zinc-100 px-3 py-2.5 text-xs dark:bg-zinc-800">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Estimated Fill
              </p>
              <div className="space-y-1 text-zinc-600 dark:text-zinc-300">
                <div className="flex justify-between">
                  <span>Avg price</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    {fillEstimate.avgPrice.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Worst price</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {fillEstimate.worstPrice.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{tab === "buy" ? "Total cost" : "Total proceeds"}</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {fillEstimate.totalCost.toFixed(6)} {buyingCurrency.currency}
                  </span>
                </div>
                {fillEstimate.slippage !== null && (
                  <div className="flex justify-between">
                    <span>Slippage vs mid</span>
                    <span
                      className={`font-mono ${
                        fillEstimate.slippage.gte(1)
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {fillEstimate.slippage.toFixed(2)}%
                    </span>
                  </div>
                )}
                {(fillEstimate.clobFilled.gt(0) || fillEstimate.ammFilled.gt(0)) && (
                  <div className="flex justify-between">
                    <span>Source</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {fillEstimate.clobFilled.gt(0) && fillEstimate.ammFilled.gt(0)
                        ? `${fillEstimate.clobFilled.toFixed(4)} via order book \u00B7 ${fillEstimate.ammFilled.toFixed(4)} via AMM`
                        : fillEstimate.clobFilled.gt(0)
                          ? `${fillEstimate.clobFilled.toFixed(4)} via order book`
                          : `${fillEstimate.ammFilled.toFixed(4)} via AMM`}
                    </span>
                  </div>
                )}
              </div>
              {!fillEstimate.fullFill && (
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  Insufficient depth — only {fillEstimate.filledAmount.toFixed(6)}{" "}
                  {sellingCurrency.currency} of {amount} can be filled
                </p>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>Execution Type</label>
            <CustomSelect
              value={executionType}
              onChange={(val) => setExecutionType(val as ExecutionType)}
              options={EXECUTION_OPTIONS}
              className="mt-1"
            />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={sellMode}
                onChange={(e) => setSellMode(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              Sell Mode
            </label>
            {activeDomainID && (
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={hybridMode}
                  onChange={(e) => setHybridMode(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
                Hybrid — Places offer on both open DEX and permissioned domain order books
              </label>
            )}
          </div>

          <div>
            <label className={labelClass}>Expiration (optional)</label>
            <input
              type="datetime-local"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className={inputClass}
            />
          </div>

          {insufficientBalance && (
            <p className={errorTextClass}>
              Insufficient {spendCurrency.currency} balance — you have {availableBalance.toFixed(6)}{" "}
              but need {new BigNumber(spendAmount).toFixed(6)}
            </p>
          )}

          {error && <p className={errorTextClass}>{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 ${
              tab === "buy"
                ? "bg-green-600 hover:bg-green-500 hover:shadow-md active:scale-[0.98] dark:bg-green-700 dark:hover:bg-green-600"
                : "bg-red-600 hover:bg-red-500 hover:shadow-md active:scale-[0.98] dark:bg-red-700 dark:hover:bg-red-600"
            }`}
          >
            {submitting
              ? getSigningLoadingText(adapter, "Placing...")
              : tab === "buy"
                ? "Place Buy Order"
                : "Place Sell Order"}
          </button>
        </form>
      )}
    </div>
  );
}
