"use client";

import { useState, useEffect } from "react";
import type { WalletInfo, BalanceEntry, Contact } from "@/lib/types";
import { errorTextClass, SUCCESS_MESSAGE_DURATION_MS, labelClass } from "@/lib/ui/ui";
import { Assets } from "@/lib/assets";
import { ModalShell } from "@/app/components/modal-shell";
import { useBalances } from "@/lib/hooks/use-balances";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useTrustLineValidation } from "@/lib/hooks/use-trust-line-validation";

interface TransferModalProps {
  sender: WalletInfo;
  contacts: Contact[];
  onComplete: () => void;
  onClose: () => void;
}

const selectClass = "mt-1 w-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80";
const inputFieldClass = "w-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80";

export function TransferModal({
  sender,
  contacts,
  onComplete,
  onClose,
}: TransferModalProps) {
  const { state: { network } } = useAppState();
  const { balances, loading: loadingBalances } = useBalances(sender.address, network);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientMode, setRecipientMode] = useState<"contact" | "other">(
    contacts.length > 0 ? "contact" : "other",
  );
  const [selectedContactIdx, setSelectedContactIdx] = useState(0);
  const [customRecipient, setCustomRecipient] = useState("");
  const [customDestTag, setCustomDestTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (balances.length > 0 && !selectedCurrency) {
      setSelectedCurrency("0");
    }
  }, [balances, selectedCurrency]);

  const selectedBalance = balances[parseInt(selectedCurrency)] || null;

  const selectedContact = recipientMode === "contact" && contacts.length > 0
    ? contacts[selectedContactIdx]
    : null;

  const destinationAddress =
    recipientMode === "contact"
      ? selectedContact?.address ?? ""
      : customRecipient.trim();

  const destinationTag =
    recipientMode === "contact"
      ? selectedContact?.destinationTag
      : customDestTag.trim()
        ? parseInt(customDestTag.trim(), 10)
        : undefined;

  const { trustLineOk, checkingTrustLine, ripplingOk } = useTrustLineValidation({
    selectedBalance,
    destinationAddress,
    network,
    senderAddress: sender.address,
  });

  const currencyLabel = (b: BalanceEntry) => {
    if (b.currency === Assets.XRP) return `${Assets.XRP} (${b.value})`;
    const issuerLabel = b.issuer ? ` — ${b.issuer}` : "";
    return `${b.currency} (${b.value}${issuerLabel})`;
  };

  const amountValid =
    amount !== "" &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0 &&
    selectedBalance !== null &&
    parseFloat(amount) <= parseFloat(selectedBalance.value);

  const isIssuedCurrency = selectedBalance !== null && selectedBalance.currency !== Assets.XRP;
  const isBurn = isIssuedCurrency && !!destinationAddress && destinationAddress === selectedBalance?.issuer;
  const trustLineBlocked = isIssuedCurrency && trustLineOk === false;
  const ripplingBlocked = isIssuedCurrency && trustLineOk === true && ripplingOk === false;

  const canSubmit =
    !submitting && amountValid && destinationAddress.length > 0 && selectedBalance !== null && !trustLineBlocked && !ripplingBlocked;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedBalance) return;

    setSubmitting(true);
    setError(null);

    const isXrp = selectedBalance.currency === Assets.XRP;

    const payload: Record<string, unknown> = {
      senderSeed: sender.seed,
      recipientAddress: destinationAddress,
      currencyCode: selectedBalance.currency,
      amount,
      network,
    };

    if (!isXrp && selectedBalance.issuer) {
      payload.issuerAddress = selectedBalance.issuer;
    }

    if (destinationTag !== undefined && !isNaN(destinationTag)) {
      payload.destinationTag = destinationTag;
    }

    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transfer failed");
      } else {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, SUCCESS_MESSAGE_DURATION_MS);
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Send Currency" onClose={onClose}>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        From: <span className="font-mono">{sender.address}</span>
      </p>

      {success ? (
        <div className="mt-6 bg-green-50 p-4 text-center text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Transfer successful!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={labelClass}>Currency</label>
            {loadingBalances ? (
              <div className="mt-1 h-10 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
            ) : balances.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-400">No balances found</p>
            ) : (
              <select
                value={selectedCurrency}
                onChange={(e) => {
                  setSelectedCurrency(e.target.value);
                  setAmount("");
                }}
                className={selectClass}
              >
                {balances.map((b, i) => (
                  <option key={i} value={String(i)}>
                    {currencyLabel(b)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelClass}>Amount</label>
            <input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={
                selectedBalance
                  ? `Max: ${selectedBalance.value}`
                  : "0.00"
              }
              className={`mt-1 ${inputFieldClass}`}
            />
            {amount !== "" && !amountValid && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                Enter a valid amount within your balance
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Recipient</label>
            <div className="mt-1.5 flex gap-1.5">
              {contacts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRecipientMode("contact")}
                  aria-pressed={recipientMode === "contact"}
                  className={`px-3 py-1.5 text-xs font-semibold ${
                    recipientMode === "contact"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  Contact
                </button>
              )}
              <button
                type="button"
                onClick={() => setRecipientMode("other")}
                aria-pressed={recipientMode === "other"}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  recipientMode === "other"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                Other
              </button>
            </div>
            {recipientMode === "contact" && contacts.length > 0 ? (
              <select
                value={selectedContactIdx}
                onChange={(e) => setSelectedContactIdx(Number(e.target.value))}
                className={`mt-2 ${selectClass}`}
              >
                {contacts.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label} ({c.address}{c.destinationTag !== undefined ? ` tag:${c.destinationTag}` : ""})
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={customRecipient}
                  onChange={(e) => setCustomRecipient(e.target.value)}
                  placeholder="rXXXXXXXX..."
                  className={inputFieldClass}
                />
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={customDestTag}
                  onChange={(e) => setCustomDestTag(e.target.value)}
                  placeholder="Destination Tag (optional)"
                  className={inputFieldClass}
                />
              </div>
            )}
          </div>

          {isIssuedCurrency && destinationAddress && (
            isBurn ? (
              <p className="bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Recipient is the issuer. This will burn {selectedBalance?.currency} and reduce the outstanding supply.
              </p>
            ) : checkingTrustLine ? (
              <p className="text-xs text-zinc-400">Checking trust line...</p>
            ) : trustLineOk === false ? (
              <p className="bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Recipient does not have a trust line for {selectedBalance?.currency}.
              </p>
            ) : trustLineOk === true ? (
              ripplingOk === false ? (
                <p className="bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Trust line exists, but the issuer does not have rippling enabled.
                </p>
              ) : (
                <p className="text-xs font-medium text-green-600 dark:text-green-400">Trust line verified</p>
              )
            ) : null
          )}

          {error && (
            <p className={errorTextClass}>{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-sm disabled:active:scale-100"
          >
            {submitting ? "Sending..." : "Send"}
          </button>
        </form>
      )}
    </ModalShell>
  );
}
