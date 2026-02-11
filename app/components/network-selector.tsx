"use client";

import type { PersistedState } from "@/lib/types";
import { EXPLORER_URLS } from "@/lib/xrpl/networks";
import { CustomSelect } from "@/app/components/custom-select";

interface NetworkSelectorProps {
  network: PersistedState["network"];
  walletAddress?: string;
  onChange: (network: PersistedState["network"]) => void;
}

export function NetworkSelector({ network, walletAddress, onChange }: NetworkSelectorProps) {
  const explorerHref = walletAddress
    ? `${EXPLORER_URLS[network]}/accounts/${walletAddress}`
    : EXPLORER_URLS[network];

  return (
    <div className="flex items-center gap-3">
      {network === "mainnet" && (
        <span className="animate-subtle-pulse bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 shadow-sm dark:bg-red-900/40 dark:text-red-400">
          REAL FUNDS
        </span>
      )}
      <a
        href={explorerHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Explorer
      </a>
      <CustomSelect
        id="network"
        value={network}
        onChange={(value) => onChange(value as PersistedState["network"])}
        options={[
          { value: "testnet", label: "Testnet" },
          { value: "devnet", label: "Devnet" },
          { value: "mainnet", label: "Mainnet" },
        ]}
      />
    </div>
  );
}
