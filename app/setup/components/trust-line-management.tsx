"use client";

import { useState } from "react";
import type { WalletInfo, PersistedState } from "@/lib/types";
import { useFetchTrustLines } from "@/lib/hooks/use-trust-lines";
import { WELL_KNOWN_CURRENCIES } from "@/lib/assets";
import { DEFAULT_TRUST_LINE_LIMIT } from "@/lib/xrpl/constants";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { TrustLineList } from "./trust-line-list";
import { CustomTrustLineForm } from "./custom-trust-line-form";

interface TrustLineManagementProps {
  wallet: WalletInfo;
  network: PersistedState["network"];
  refreshKey: number;
  onRefresh: () => void;
}

export function TrustLineManagement({
  wallet,
  network,
  refreshKey,
  onRefresh,
}: TrustLineManagementProps) {
  const { lines, loading, error } = useFetchTrustLines(wallet.address, network, refreshKey);
  const [trusting, setTrusting] = useState<string | null>(null);
  const [trustError, setTrustError] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const wellKnown = WELL_KNOWN_CURRENCIES[network] ?? {};

  const badges = lines.map((l) => ({
    currency: decodeCurrency(l.currency),
    issuerAddress: l.account,
  }));

  // Check if a trust line already exists for a given currency + issuer
  function hasTrustLine(currency: string, issuer: string): boolean {
    return lines.some(
      (l) =>
        l.account === issuer &&
        (l.currency === currency || decodeCurrency(l.currency) === currency),
    );
  }

  async function handleQuickTrust(currency: string, issuer: string) {
    const key = `${currency}:${issuer}`;
    setTrusting(key);
    setTrustError(null);
    try {
      const res = await fetch(`/api/accounts/${wallet.address}/trustlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: wallet.seed,
          currency,
          issuer,
          limit: DEFAULT_TRUST_LINE_LIMIT,
          network,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTrustError(data.error ?? "Failed to create trust line");
      } else {
        onRefresh();
      }
    } catch {
      setTrustError("Network error");
    } finally {
      setTrusting(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Trust Lines</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <TrustLineList badges={badges} />

      {/* One-click trust buttons for well-known currencies */}
      {Object.keys(wellKnown).length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Quick Trust</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(wellKnown).map(([currency, issuer]) => {
              const exists = hasTrustLine(currency, issuer);
              const key = `${currency}:${issuer}`;
              return (
                <button
                  key={key}
                  onClick={() => handleQuickTrust(currency, issuer)}
                  disabled={exists || trusting !== null}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    exists
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  }`}
                >
                  {trusting === key
                    ? "Creating..."
                    : exists
                      ? `${currency} (trusted)`
                      : `Trust ${currency}`}
                </button>
              );
            })}
          </div>
          {trustError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{trustError}</p>
          )}
        </div>
      )}

      {/* Custom trust line toggle */}
      <div className="mt-4">
        <button
          onClick={() => setShowCustomForm((v) => !v)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {showCustomForm ? "Hide Custom Form" : "+ Custom Trust Line"}
        </button>
        {showCustomForm && (
          <CustomTrustLineForm
            recipientAddress={wallet.address}
            recipientSeed={wallet.seed}
            network={network}
            onSuccess={onRefresh}
          />
        )}
      </div>
    </div>
  );
}
