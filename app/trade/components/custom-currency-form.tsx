"use client";

import { useState } from "react";
import { MAX_CURRENCY_CODE_LENGTH } from "@/lib/xrpl/constants";
import { labelClass } from "@/lib/ui/ui";

interface CustomCurrencyFormProps {
  onAdd: (currency: string, issuer: string) => void;
  onClose: () => void;
}

export function CustomCurrencyForm({ onAdd, onClose }: CustomCurrencyFormProps) {
  const [currency, setCurrency] = useState("");
  const [issuer, setIssuer] = useState("");

  function handleAdd() {
    const cur = currency.trim().toUpperCase();
    const iss = issuer.trim();
    if (!cur || !iss) return;
    onAdd(cur, iss);
    setCurrency("");
    setIssuer("");
    onClose();
  }

  return (
    <div className="mt-3 flex items-end gap-2 border border-zinc-200/80 bg-zinc-50/50 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex-1">
        <label className={labelClass}>Currency Code</label>
        <input
          type="text"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          placeholder="USD"
          maxLength={MAX_CURRENCY_CODE_LENGTH}
          className="mt-1 w-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80"
        />
      </div>
      <div className="flex-[2]">
        <label className={labelClass}>Issuer Address</label>
        <input
          type="text"
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          placeholder="rXXXXXXXX..."
          className="mt-1 w-full border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80"
        />
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!currency.trim() || !issuer.trim()}
        className="bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}
