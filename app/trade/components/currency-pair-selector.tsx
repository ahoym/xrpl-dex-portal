"use client";

import type { CurrencyOption } from "@/lib/hooks/use-trading-data";
import { labelClass } from "@/lib/ui/ui";

interface CurrencyPairSelectorProps {
  sellingValue: string;
  buyingValue: string;
  currencyOptions: CurrencyOption[];
  onSellingChange: (value: string) => void;
  onBuyingChange: (value: string) => void;
  onToggleCustomForm: () => void;
}

export function CurrencyPairSelector({
  sellingValue,
  buyingValue,
  currencyOptions,
  onSellingChange,
  onBuyingChange,
  onToggleCustomForm,
}: CurrencyPairSelectorProps) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-[180px] flex-1">
        <label className={labelClass}>
          Base
        </label>
        <select
          value={sellingValue}
          onChange={(e) => onSellingChange(e.target.value)}
          className="mt-1 w-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80"
        >
          <option value="">Select currency...</option>
          {currencyOptions
            .filter((o) => o.value !== buyingValue)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      </div>
      <div className="min-w-[180px] flex-1">
        <label className={labelClass}>
          Quote
        </label>
        <select
          value={buyingValue}
          onChange={(e) => onBuyingChange(e.target.value)}
          className="mt-1 w-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80"
        >
          <option value="">Select currency...</option>
          {currencyOptions
            .filter((o) => o.value !== sellingValue)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onToggleCustomForm}
        className="border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        + Custom Currency
      </button>
    </div>
  );
}
