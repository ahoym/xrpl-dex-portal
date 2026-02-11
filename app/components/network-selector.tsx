"use client";

import type { PersistedState } from "@/lib/types";
import { EXPLORER_URLS } from "@/lib/xrpl/networks";

interface NetworkSelectorProps {
  network: PersistedState["network"];
  onChange: (network: PersistedState["network"]) => void;
}

export function NetworkSelector({ network, onChange }: NetworkSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      {network === "mainnet" && (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
          REAL FUNDS
        </span>
      )}
      <a
        href={EXPLORER_URLS[network]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Network
      </a>
      <select
        id="network"
        value={network}
        onChange={(e) => onChange(e.target.value as PersistedState["network"])}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="testnet">Testnet</option>
        <option value="devnet">Devnet</option>
        <option value="mainnet">Mainnet</option>
      </select>
    </div>
  );
}
