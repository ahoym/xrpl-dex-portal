"use client";

import { useState } from "react";
import { DEFAULT_TRUST_LINE_LIMIT } from "@/lib/xrpl/constants";
import { useWalletAdapter } from "@/lib/hooks/use-wallet-adapter";
import { inputClass, labelClass, errorTextClass, primaryButtonClass } from "@/lib/ui/ui";

interface CustomTrustLineFormProps {
  recipientAddress: string;
  network: string;
  onSuccess: () => void;
}

export function CustomTrustLineForm({
  recipientAddress,
  network,
  onSuccess,
}: CustomTrustLineFormProps) {
  const { adapter, setTrustline: adapterSetTrustline } = useWalletAdapter();
  const [customIssuer, setCustomIssuer] = useState("");
  const [customCurrency, setCustomCurrency] = useState("");
  const [customLimit, setCustomLimit] = useState(DEFAULT_TRUST_LINE_LIMIT);
  const [customTrusting, setCustomTrusting] = useState(false);
  const [customTrustError, setCustomTrustError] = useState<string | null>(null);

  async function handleCustomTrust() {
    if (customTrusting) return;
    const issuerAddr = customIssuer.trim();
    const currency = customCurrency.trim();
    if (!issuerAddr) { setCustomTrustError("Issuer address is required"); return; }
    if (!currency) { setCustomTrustError("Currency code is required"); return; }
    setCustomTrusting(true);
    setCustomTrustError(null);
    try {
      const result = await adapterSetTrustline({
        address: recipientAddress,
        currency,
        issuer: issuerAddr,
        limit: customLimit,
        network,
      });
      if (!result.success) {
        setCustomTrustError(result.resultCode ?? "Failed to create trust line");
      } else {
        setCustomIssuer("");
        setCustomCurrency("");
        setCustomLimit(DEFAULT_TRUST_LINE_LIMIT);
        onSuccess();
      }
    } catch (err) {
      setCustomTrustError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCustomTrusting(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border border-zinc-200/80 bg-zinc-50/50 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/30">
      <div>
        <label className={labelClass}>Issuer Address</label>
        <input
          type="text"
          value={customIssuer}
          onChange={(e) => setCustomIssuer(e.target.value)}
          placeholder="rXXXXXXXX..."
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Currency Code</label>
        <input
          type="text"
          value={customCurrency}
          onChange={(e) => setCustomCurrency(e.target.value)}
          placeholder="USD"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Limit</label>
        <input
          type="number"
          step="any"
          min="0"
          value={customLimit}
          onChange={(e) => setCustomLimit(e.target.value)}
          className={inputClass}
        />
      </div>
      <button
        onClick={handleCustomTrust}
        disabled={customTrusting}
        className={`${primaryButtonClass} px-3 py-1.5 text-xs`}
      >
        {customTrusting
          ? adapter && adapter.type !== "seed"
            ? `Confirm in ${adapter.displayName}...`
            : "Creating..."
          : "Create Trust Line"}
      </button>
      {customTrustError && (
        <p className={errorTextClass}>{customTrustError}</p>
      )}
    </div>
  );
}
