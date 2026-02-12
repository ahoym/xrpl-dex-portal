"use client";

import { useState } from "react";
import type { WalletInfo, PersistedState, Contact } from "@/lib/types";
import { secondaryButtonClass, dangerButtonClass } from "@/lib/ui/ui";

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

          const isWallet = (w: unknown): boolean => {
            if (!w || typeof w !== "object") return false;
            const obj = w as Record<string, unknown>;
            if (typeof obj.address !== "string" || typeof obj.publicKey !== "string") return false;
            // Seed wallets require seed; extension wallets require type
            return typeof obj.seed === "string" || typeof obj.type === "string";
          };

          if (
            !parsed ||
            (parsed.network !== "testnet" && parsed.network !== "devnet" && parsed.network !== "mainnet") ||
            !("wallet" in parsed) ||
            (parsed.wallet !== null && !isWallet(parsed.wallet))
          ) {
            alert("Invalid file: network must be testnet, devnet, or mainnet, and wallet must have address and publicKey.");
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
        <button onClick={handleImport} className={secondaryButtonClass}>
          Import JSON
        </button>
        <button
          onClick={handleExport}
          disabled={!state.wallet && contacts.length === 0}
          className={`${secondaryButtonClass} disabled:opacity-50`}
        >
          Export as JSON
        </button>
        <button
          onClick={() => setShowJson((v) => !v)}
          disabled={!state.wallet && contacts.length === 0}
          className={`${secondaryButtonClass} disabled:opacity-50`}
        >
          {showJson ? "Hide JSON" : "View JSON"}
        </button>
        <button
          onClick={() => {
            if (window.confirm("Clear all stored wallets and data? This cannot be undone.")) {
              onClear();
            }
          }}
          className={dangerButtonClass}
        >
          Clear All Data
        </button>
      </div>
      {showJson && (
        <pre className="mt-4 max-h-96 overflow-auto border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-800 shadow-inner dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {JSON.stringify(exportData, null, 2)}
        </pre>
      )}
    </div>
  );
}
