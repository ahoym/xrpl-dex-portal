"use client";

import { useState } from "react";
import type { WalletInfo, PersistedState, Contact } from "@/lib/types";

interface DataManagementProps {
  state: PersistedState;
  contacts: Contact[];
  onImport: (data: { network: PersistedState["network"]; wallet: WalletInfo | null; contacts?: Contact[] }) => void;
  onClear: () => void;
}

export function DataManagement({ state, contacts, onImport, onClear }: DataManagementProps) {
  const [showJson, setShowJson] = useState(false);

  const exportData = {
    network: state.network,
    wallet: state.wallet,
    contacts,
  };

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);

          const isWallet = (w: unknown): boolean =>
            !!w &&
            typeof w === "object" &&
            typeof (w as Record<string, unknown>).address === "string" &&
            typeof (w as Record<string, unknown>).seed === "string" &&
            typeof (w as Record<string, unknown>).publicKey === "string";

          if (
            !parsed ||
            (parsed.network !== "testnet" && parsed.network !== "devnet" && parsed.network !== "mainnet") ||
            !("wallet" in parsed) ||
            (parsed.wallet !== null && !isWallet(parsed.wallet))
          ) {
            alert("Invalid file: network must be testnet, devnet, or mainnet, and wallet must have address, seed, and publicKey.");
            return;
          }

          if (state.wallet) {
            if (!window.confirm("This will replace all current data. Continue?")) return;
          }

          onImport({
            network: parsed.network,
            wallet: parsed.wallet,
            contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
          });
        } catch {
          alert("Failed to parse JSON file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xrpl-dex-portal-${state.network}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleImport}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Import JSON
        </button>
        <button
          onClick={handleExport}
          disabled={!state.wallet && contacts.length === 0}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Export as JSON
        </button>
        <button
          onClick={() => setShowJson((v) => !v)}
          disabled={!state.wallet && contacts.length === 0}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {showJson ? "Hide JSON" : "View JSON"}
        </button>
        <button
          onClick={() => {
            if (window.confirm("Clear all stored wallets and data? This cannot be undone.")) {
              onClear();
            }
          }}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
        >
          Clear All Data
        </button>
      </div>
      {showJson && (
        <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-zinc-50 p-4 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          {JSON.stringify(exportData, null, 2)}
        </pre>
      )}
    </div>
  );
}
