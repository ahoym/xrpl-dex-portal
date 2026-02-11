"use client";

import { useState, useEffect, useRef } from "react";
import type { WalletInfo } from "@/lib/types";
import { useAppState } from "@/lib/hooks/use-app-state";
import type { OfferFlag } from "@/lib/xrpl/types";
import { toRippleEpoch } from "@/lib/xrpl/constants";
import { inputClass, labelClass, errorTextClass, SUCCESS_MESSAGE_DURATION_MS } from "@/lib/ui/ui";
import { buildDexAmount } from "@/lib/xrpl/build-dex-amount";
import { CustomSelect } from "@/app/components/custom-select";

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
  prefill?: TradeFormPrefill;
  onSubmitted: () => void;
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
  prefill,
  onSubmitted,
}: TradeFormProps) {
  const { state: { network } } = useAppState();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [executionType, setExecutionType] = useState<ExecutionType>("");
  const [sellMode, setSellMode] = useState(false);
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

  const total =
    amount && price
      ? (parseFloat(amount) * parseFloat(price)).toFixed(6)
      : "";

  const canSubmit =
    !submitting &&
    amount !== "" &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0 &&
    price !== "" &&
    !isNaN(parseFloat(price)) &&
    parseFloat(price) > 0;

  function buildFlags(): OfferFlag[] {
    const flags: OfferFlag[] = [];
    if (executionType) flags.push(executionType);
    if (sellMode) flags.push("sell");
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
      takerGets = buildDexAmount(
        buyingCurrency.currency,
        buyingCurrency.issuer,
        total,
      );
      takerPays = buildDexAmount(
        sellingCurrency.currency,
        sellingCurrency.issuer,
        amount,
      );
    } else {
      takerGets = buildDexAmount(
        sellingCurrency.currency,
        sellingCurrency.issuer,
        amount,
      );
      takerPays = buildDexAmount(
        buyingCurrency.currency,
        buyingCurrency.issuer,
        total,
      );
    }

    const payload: Record<string, unknown> = {
      seed: focusedWallet.seed,
      takerGets,
      takerPays,
      network,
    };

    const flags = buildFlags();
    if (flags.length > 0) {
      payload.flags = flags;
    }

    if (expiration) {
      const epochMs = new Date(expiration).getTime();
      if (!isNaN(epochMs)) {
        payload.expiration = toRippleEpoch(epochMs);
      }
    }

    try {
      const res = await fetch("/api/dex/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to place offer");
      } else {
        setSuccess(true);
        setAmount("");
        setPrice("");
        setExecutionType("");
        setSellMode(false);
        setExpiration("");
        setTimeout(() => {
          setSuccess(false);
          onSubmitted();
        }, SUCCESS_MESSAGE_DURATION_MS);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Place Order
      </h3>

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
          <div>
            <label className={labelClass}>
              Amount ({sellingCurrency.currency})
            </label>
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
            <label className={labelClass}>
              Total ({buyingCurrency.currency})
            </label>
            <div className="mt-1 border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
              {total || "—"}
            </div>
          </div>

          {amount && price && total && (
            <div className="bg-zinc-100 px-3 py-2.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {tab === "buy" ? (
                <>Pay <span className="font-bold text-zinc-900 dark:text-zinc-100">{total} {buyingCurrency.currency}</span> to receive <span className="font-bold text-zinc-900 dark:text-zinc-100">{amount} {sellingCurrency.currency}</span></>
              ) : (
                <>Sell <span className="font-bold text-zinc-900 dark:text-zinc-100">{amount} {sellingCurrency.currency}</span> to receive <span className="font-bold text-zinc-900 dark:text-zinc-100">{total} {buyingCurrency.currency}</span></>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>
              Execution Type
            </label>
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
          </div>

          <div>
            <label className={labelClass}>
              Expiration (optional)
            </label>
            <input
              type="datetime-local"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className={errorTextClass}>{error}</p>
          )}

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
              ? "Placing..."
              : tab === "buy"
                ? "Place Buy Order"
                : "Place Sell Order"}
          </button>
        </form>
      )}
    </div>
  );
}
