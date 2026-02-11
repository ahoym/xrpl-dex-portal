"use client";

import type { CurrencyOption } from "@/lib/hooks/use-trading-data";
import { CustomSelect } from "@/app/components/custom-select";
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
        <CustomSelect
          value={sellingValue}
          onChange={onSellingChange}
          placeholder="Select currency..."
          className="mt-1"
          options={[
            { value: "", label: "Select currency..." },
            ...currencyOptions.filter((o) => o.value !== buyingValue),
          ]}
        />
      </div>
      <div className="min-w-[180px] flex-1">
        <label className={labelClass}>
          Quote
        </label>
        <CustomSelect
          value={buyingValue}
          onChange={onBuyingChange}
          placeholder="Select currency..."
          className="mt-1"
          options={[
            { value: "", label: "Select currency..." },
            ...currencyOptions.filter((o) => o.value !== sellingValue),
          ]}
        />
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
