"use client";

import { useState } from "react";
import type { WalletInfo } from "@/lib/types";
import { inputClass, labelClass, errorTextClass } from "@/lib/ui/ui";
import { ModalShell } from "@/app/components/modal-shell";

interface CurrencyOption {
  currency: string;
  issuer?: string;
}

export interface MakeMarketOrder {
  side: "Bid" | "Ask";
  level: number;
  price: string;
  qty: string;
  wallet: WalletInfo;
}

interface MakeMarketModalProps {
  baseCurrency: CurrencyOption | null;
  quoteCurrency: CurrencyOption | null;
  wallet: WalletInfo;
  onClose: () => void;
  onExecute: (orders: MakeMarketOrder[]) => void;
}

interface LadderLevel {
  spreadPct: number;
  qty: number;
}

const DEFAULT_LEVELS: LadderLevel[] = [
  { spreadPct: 2, qty: 5 },
  { spreadPct: 5, qty: 10 },
  { spreadPct: 10, qty: 20 },
];

export function MakeMarketModal({
  baseCurrency,
  quoteCurrency,
  wallet,
  onClose,
  onExecute,
}: MakeMarketModalProps) {
  const [midPrice, setMidPrice] = useState("");
  const [levels, setLevels] = useState<LadderLevel[]>(
    DEFAULT_LEVELS.map((l) => ({ ...l })),
  );

  const [step, setStep] = useState<"form" | "preview">("form");
  const [plannedOrders, setPlannedOrders] = useState<MakeMarketOrder[]>([]);
  const [error] = useState<string | null>(null);

  const midPriceNum = parseFloat(midPrice);
  const midPriceValid =
    midPrice !== "" && !isNaN(midPriceNum) && midPriceNum > 0;

  if (!baseCurrency || !quoteCurrency) {
    return (
      <ModalShell title="Make Market" onClose={onClose}>
        <p className={`mt-4 ${errorTextClass}`}>
          Select a currency pair first.
        </p>
      </ModalShell>
    );
  }

  function updateLevel(
    index: number,
    field: keyof LadderLevel,
    value: string,
  ) {
    setLevels((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, [field]: parseFloat(value) || 0 } : l,
      ),
    );
  }

  function handlePreview() {
    if (!midPriceValid || !baseCurrency || !quoteCurrency) return;

    const orders: MakeMarketOrder[] = [];

    for (let i = 0; i < levels.length; i++) {
      const { spreadPct, qty } = levels[i];
      const halfSpread = spreadPct / 2 / 100;

      const bidPrice = midPriceNum * (1 - halfSpread);
      const askPrice = midPriceNum * (1 + halfSpread);

      orders.push({
        side: "Bid",
        level: i + 1,
        price: bidPrice.toFixed(6),
        qty: qty.toString(),
        wallet,
      });
      orders.push({
        side: "Ask",
        level: i + 1,
        price: askPrice.toFixed(6),
        qty: qty.toString(),
        wallet,
      });
    }

    setPlannedOrders(orders);
    setStep("preview");
  }

  function handleConfirm() {
    onExecute(plannedOrders);
  }

  if (step === "preview") {
    return (
      <ModalShell title="Preview Orders" onClose={onClose}>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {baseCurrency.currency} / {quoteCurrency.currency} &middot; Mid
          price: {midPrice}
        </p>

        <div className="mt-4 max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="pb-1 pr-2">Side</th>
                <th className="pb-1 pr-2">Level</th>
                <th className="pb-1 pr-2">Price</th>
                <th className="pb-1 pr-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {plannedOrders.map((o, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td
                    className={`py-1 pr-2 font-medium ${
                      o.side === "Bid"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {o.side}
                  </td>
                  <td className="py-1 pr-2 text-zinc-700 dark:text-zinc-300">
                    {o.level}
                  </td>
                  <td className="py-1 pr-2 font-mono text-zinc-700 dark:text-zinc-300">
                    {o.price}
                  </td>
                  <td className="py-1 pr-2 text-zinc-700 dark:text-zinc-300">
                    {o.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setStep("form")}
            className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Place Orders
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Make Market" onClose={onClose}>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Place a 3-level bid/ask ladder for {baseCurrency.currency} /{" "}
        {quoteCurrency.currency}
      </p>

      {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}

      <div className="mt-4 space-y-4">
        <div>
          <label className={labelClass}>
            Mid Price ({quoteCurrency.currency} per {baseCurrency.currency})
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={midPrice}
            onChange={(e) => setMidPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Ladder Levels</label>
          <div className="mt-1 space-y-2">
            {levels.map((level, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 text-xs text-zinc-500 dark:text-zinc-400">
                  Level {i + 1}
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={level.spreadPct || ""}
                  onChange={(e) => updateLevel(i, "spreadPct", e.target.value)}
                  className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="%"
                />
                <span className="text-xs text-zinc-400">% spread</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={level.qty || ""}
                  onChange={(e) => updateLevel(i, "qty", e.target.value)}
                  className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="qty"
                />
                <span className="text-xs text-zinc-400">qty</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handlePreview}
          disabled={!midPriceValid}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          Preview Orders
        </button>
      </div>
    </ModalShell>
  );
}
