"use client";

import { useState } from "react";
import BigNumber from "bignumber.js";
import type { OrderBookAmount } from "@/lib/types";
import type { FilledOrder } from "@/lib/xrpl/filled-orders";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { fromRippleEpoch } from "@/lib/xrpl/constants";
import { useAppState } from "@/lib/hooks/use-app-state";
import { EXPLORER_URLS } from "@/lib/xrpl/networks";
import { formatTime, formatDateTime } from "@/lib/ui/format-time";

interface AccountOffer {
  seq: number;
  flags: number;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  expiration?: number;
  domainID?: string;
}

interface OrdersSheetProps {
  openOrders: AccountOffer[];
  loadingOpen: boolean;
  filledOrders: FilledOrder[];
  loadingFilled: boolean;
  pairSelected: boolean;
  baseCurrency?: string;
  baseIssuer?: string;
  quoteCurrency?: string;
  cancellingSeq: number | null;
  onCancel: (seq: number) => void;
  activeDomainID?: string;
}

type Tab = "open" | "filled";

function formatOfferSide(amt: OrderBookAmount): string {
  const cur = decodeCurrency(amt.currency);
  return `${new BigNumber(amt.value).toFixed(4)} ${cur}`;
}

export function OrdersSheet({
  openOrders,
  loadingOpen,
  filledOrders,
  loadingFilled,
  pairSelected,
  baseCurrency,
  baseIssuer,
  quoteCurrency,
  cancellingSeq,
  onCancel,
  activeDomainID,
}: OrdersSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const [collapsed, setCollapsed] = useState(true);
  const { state } = useAppState();
  const explorerBase = EXPLORER_URLS[state.network];

  const pairLabel = baseCurrency && quoteCurrency ? `${baseCurrency}/${quoteCurrency}` : "";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-zinc-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_-4px_16px_rgba(0,0,0,0.3)] lg:block">
      <div
        className={`mx-auto flex max-w-[1800px] flex-col transition-[height] duration-200 ${collapsed ? "h-11" : "h-[33vh]"}`}
      >
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-zinc-100 px-4 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("open")}
            className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "open"
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Open{pairSelected && !loadingOpen ? ` (${openOrders.length})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("filled")}
            className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "filled"
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Filled{pairSelected && !loadingFilled ? ` (${filledOrders.length})` : ""}
          </button>
          {pairLabel && (
            <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{pairLabel}</span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label={collapsed ? "Expand orders" : "Collapse orders"}
          >
            {collapsed ? "Show Orders" : "Hide"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {activeTab === "open" ? (
              <OpenOrdersContent
                offers={openOrders}
                loading={loadingOpen}
                pairSelected={pairSelected}
                baseCurrency={baseCurrency}
                baseIssuer={baseIssuer}
                cancellingSeq={cancellingSeq}
                onCancel={onCancel}
                activeDomainID={activeDomainID}
              />
            ) : (
              <FilledOrdersContent
                orders={filledOrders}
                loading={loadingFilled}
                pairSelected={pairSelected}
                explorerBase={explorerBase}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile version — regular in-flow section                          */
/* ------------------------------------------------------------------ */

export function OrdersSection({
  openOrders,
  loadingOpen,
  filledOrders,
  loadingFilled,
  pairSelected,
  baseCurrency,
  baseIssuer,
  quoteCurrency,
  cancellingSeq,
  onCancel,
  activeDomainID,
}: OrdersSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const { state } = useAppState();
  const explorerBase = EXPLORER_URLS[state.network];

  const pairLabel = baseCurrency && quoteCurrency ? `${baseCurrency}/${quoteCurrency}` : "";

  return (
    <div className="border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 lg:hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-zinc-100 px-4 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("open")}
          className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "open"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Open{pairSelected && !loadingOpen ? ` (${openOrders.length})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("filled")}
          className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "filled"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Filled{pairSelected && !loadingFilled ? ` (${filledOrders.length})` : ""}
        </button>
        {pairLabel && (
          <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{pairLabel}</span>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
        {activeTab === "open" ? (
          <OpenOrdersContent
            offers={openOrders}
            loading={loadingOpen}
            pairSelected={pairSelected}
            baseCurrency={baseCurrency}
            baseIssuer={baseIssuer}
            cancellingSeq={cancellingSeq}
            onCancel={onCancel}
            activeDomainID={activeDomainID}
          />
        ) : (
          <FilledOrdersContent
            orders={filledOrders}
            loading={loadingFilled}
            pairSelected={pairSelected}
            explorerBase={explorerBase}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
      ))}
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">{text}</p>;
}

function computeOfferFields(offer: AccountOffer, baseCurrency?: string, baseIssuer?: string) {
  const isBuy = baseCurrency ? matchesCurrency(offer.taker_pays, baseCurrency, baseIssuer) : false;

  const baseAmt = isBuy
    ? new BigNumber(offer.taker_pays.value)
    : new BigNumber(offer.taker_gets.value);
  const quoteAmt = isBuy
    ? new BigNumber(offer.taker_gets.value)
    : new BigNumber(offer.taker_pays.value);
  const price = baseAmt.gt(0) ? quoteAmt.div(baseAmt) : new BigNumber(0);

  return { isBuy, price, baseAmt, quoteAmt };
}

function OpenOrdersContent({
  offers,
  loading,
  pairSelected,
  baseCurrency,
  baseIssuer,
  cancellingSeq,
  onCancel,
  activeDomainID,
}: {
  offers: AccountOffer[];
  loading: boolean;
  pairSelected: boolean;
  baseCurrency?: string;
  baseIssuer?: string;
  cancellingSeq: number | null;
  onCancel: (seq: number) => void;
  activeDomainID?: string;
}) {
  if (loading) return <LoadingSkeleton rows={3} />;
  if (!pairSelected) return <EmptyMessage text="Select a pair to see your orders" />;
  if (offers.length === 0) return <EmptyMessage text="No open orders for this pair" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
            <th className="pb-2 pr-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Side
            </th>
            <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Price
            </th>
            <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Amount
            </th>
            <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Total
            </th>
            <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Expiry
            </th>
            <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Domain
            </th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500"></th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => {
            const { isBuy, price, baseAmt, quoteAmt } = computeOfferFields(
              offer,
              baseCurrency,
              baseIssuer,
            );
            const isHybrid = (offer.flags & 0x00100000) !== 0;
            const canCancel = isHybrid
              ? true
              : activeDomainID
                ? offer.domainID === activeDomainID
                : !offer.domainID;
            return (
              <tr
                key={offer.seq}
                className={`border-b ${
                  isBuy
                    ? "border-green-100 bg-green-50/40 dark:border-green-900/30 dark:bg-green-950/20"
                    : "border-red-100 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/20"
                }`}
              >
                <td className="py-2 pr-2">
                  <span
                    className={
                      isBuy
                        ? "font-semibold text-green-600 dark:text-green-400"
                        : "font-semibold text-red-600 dark:text-red-400"
                    }
                  >
                    {isBuy ? "Buy" : "Sell"}
                  </span>
                </td>
                <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                  {price.toFixed(4)}
                </td>
                <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                  {baseAmt.toFixed(4)}
                </td>
                <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                  {quoteAmt.toFixed(4)}
                </td>
                <td className="py-2 pr-2 text-right text-zinc-500 dark:text-zinc-400">
                  {offer.expiration != null ? (
                    <span className="group relative cursor-default">
                      {formatTime(fromRippleEpoch(offer.expiration).toISOString())}
                      <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap bg-zinc-800 px-2.5 py-1 text-xs text-white shadow-lg group-hover:block dark:bg-zinc-700">
                        {fromRippleEpoch(offer.expiration).toLocaleString()}
                      </span>
                    </span>
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-2 pr-2 text-right font-mono text-zinc-500 dark:text-zinc-400">
                  {offer.domainID ? (
                    <span title={offer.domainID}>{offer.domainID.slice(0, 8)}...</span>
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {canCancel && (
                    <button
                      onClick={() => onCancel(offer.seq)}
                      disabled={cancellingSeq !== null}
                      className="border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-50 active:scale-[0.98] dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      {cancellingSeq === offer.seq ? "Cancelling..." : "Cancel"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilledOrdersContent({
  orders,
  loading,
  pairSelected,
  explorerBase,
}: {
  orders: FilledOrder[];
  loading: boolean;
  pairSelected: boolean;
  explorerBase: string;
}) {
  if (loading) return <LoadingSkeleton rows={3} />;
  if (!pairSelected) return <EmptyMessage text="Select a pair to see filled orders" />;
  if (orders.length === 0) return <EmptyMessage text="No filled orders for this pair" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
            <th className="pb-2 pr-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Side
            </th>
            <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Price
            </th>
            <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Amount
            </th>
            <th className="pb-2 pr-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Total
            </th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.hash}
              className={`cursor-pointer border-b ${
                order.side === "buy"
                  ? "border-green-100 bg-green-50/40 hover:bg-green-50 dark:border-green-900/30 dark:bg-green-950/20 dark:hover:bg-green-950/40"
                  : "border-red-100 bg-red-50/40 hover:bg-red-50 dark:border-red-900/30 dark:bg-red-950/20 dark:hover:bg-red-950/40"
              }`}
              onClick={() =>
                window.open(
                  `${explorerBase}/transactions/${order.hash}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <td className="py-2 pr-2">
                <span
                  className={
                    order.side === "buy"
                      ? "font-semibold text-green-600 dark:text-green-400"
                      : "font-semibold text-red-600 dark:text-red-400"
                  }
                >
                  {order.side === "buy" ? "Buy" : "Sell"}
                </span>
              </td>
              <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                {order.price === "—" ? "—" : new BigNumber(order.price).toFixed(4)}
              </td>
              <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                {order.baseAmount === "—" ? "—" : new BigNumber(order.baseAmount).toFixed(4)}
              </td>
              <td className="py-2 pr-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                {order.quoteAmount === "—" ? "—" : new BigNumber(order.quoteAmount).toFixed(4)}
              </td>
              <td className="py-2 text-right text-zinc-500 dark:text-zinc-400">
                <span className="group relative cursor-default">
                  {formatTime(order.time)}
                  <span className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap bg-zinc-800 px-2.5 py-1 text-xs text-white shadow-lg group-hover:block dark:bg-zinc-700">
                    {formatDateTime(order.time)}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
