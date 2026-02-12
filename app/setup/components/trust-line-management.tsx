"use client";

import { useState } from "react";
import type { WalletInfo, PersistedState } from "@/lib/types";
import { useFetchTrustLines } from "@/lib/hooks/use-trust-lines";
import { useBalances } from "@/lib/hooks/use-balances";
import { WELL_KNOWN_CURRENCIES, Assets } from "@/lib/assets";
import { DEFAULT_TRUST_LINE_LIMIT } from "@/lib/xrpl/constants";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { TrustLineList } from "./trust-line-list";
import { CustomTrustLineForm } from "./custom-trust-line-form";
import { cardClass, errorTextClass } from "@/lib/ui/ui";

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
  const { balances } = useBalances(wallet.address, network, refreshKey);
  const [trusting, setTrusting] = useState<string | null>(null);
  const [trustError, setTrustError] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const xrpBalance = parseFloat(
    balances.find((b) => b.currency === Assets.XRP)?.value ?? "0",
  );
  const hasSufficientXrp = xrpBalance >= 1;

  const wellKnown = WELL_KNOWN_CURRENCIES[network] ?? {};

  const badges = lines.map((l) => ({
    currency: decodeCurrency(l.currency),
    issuerAddress: l.account,
  }));

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
    <div className={cardClass}>
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Trust Lines</h2>
        <p className={`mt-0.5 text-xs ${hasSufficientXrp ? "text-zinc-400 dark:text-zinc-500" : "text-amber-600 dark:text-amber-400"}`}>
          {hasSufficientXrp
            ? "Manage trust lines for issued currencies"
            : "Wallet needs at least 1 XRP before adding trust lines"}
        </p>
      </div>

      {error && (
        <p className={`mt-2 ${errorTextClass}`}>{error}</p>
      )}

      <TrustLineList badges={badges} />

      {Object.keys(wellKnown).length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Quick Trust</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(wellKnown).map(([currency, issuer]) => {
              const exists = hasTrustLine(currency, issuer);
              const key = `${currency}:${issuer}`;
              return (
                <button
                  key={key}
                  onClick={() => handleQuickTrust(currency, issuer)}
                  disabled={exists || trusting !== null || !hasSufficientXrp}
                  className={`px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-[0.98] ${
                    exists
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : "bg-blue-600 text-white hover:bg-blue-500 hover:shadow-md disabled:opacity-50"
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
            <p className={`mt-2 ${errorTextClass}`}>{trustError}</p>
          )}
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={() => setShowCustomForm((v) => !v)}
          disabled={!hasSufficientXrp}
          className="text-xs font-semibold text-blue-600 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:text-blue-400 dark:hover:text-blue-300"
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
