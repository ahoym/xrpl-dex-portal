"use client";

import { useState } from "react";
import { Wallet } from "xrpl";
import type { WalletInfo, PersistedState } from "@/lib/types";
import { useWalletGeneration } from "@/lib/hooks/use-wallet-generation";
import { ExplorerLink } from "@/app/components/explorer-link";
import { SecretField } from "./secret-field";
import { inputClass, labelClass, errorTextClass } from "@/lib/ui/ui";

interface WalletSetupProps {
  wallet: WalletInfo | null;
  network: PersistedState["network"];
  onSetWallet: (wallet: WalletInfo | null) => void;
}

export function WalletSetup({ wallet, network, onSetWallet }: WalletSetupProps) {
  const { loading: generating, error: generateError, generate } = useWalletGeneration();
  const [importSeed, setImportSeed] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  function handleImport() {
    const seed = importSeed.trim();
    if (!seed) {
      setImportError("Seed is required");
      return;
    }
    try {
      const w = Wallet.fromSeed(seed);
      onSetWallet({
        address: w.address,
        seed: w.seed!,
        publicKey: w.publicKey,
      });
      setImportSeed("");
      setImportError(null);
    } catch {
      setImportError("Invalid seed format");
    }
  }

  if (wallet) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Wallet</h2>
        <div className="mt-3 space-y-1 text-sm">
          <p>
            <span className="text-zinc-500 dark:text-zinc-400">Address: </span>
            <ExplorerLink address={wallet.address} />
          </p>
          <SecretField label="Seed" value={wallet.seed} />
          <p className="break-all">
            <span className="text-zinc-500 dark:text-zinc-400">Public Key: </span>
            {wallet.publicKey}
          </p>
        </div>
        <button
          onClick={() => {
            if (window.confirm("Remove wallet? This cannot be undone.")) {
              onSetWallet(null);
            }
          }}
          className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
        >
          Remove Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Wallet</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Generate a new wallet or import an existing one via seed.
      </p>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => generate(network, onSetWallet)}
          disabled={generating}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Wallet"}
        </button>
      </div>
      {network === "mainnet" && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Mainnet wallets are generated locally and are not funded. You must send XRP to activate them.
        </p>
      )}
      {generateError && <p className={`mt-2 ${errorTextClass}`}>{generateError}</p>}

      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <label className={labelClass}>Import from Seed</label>
        <div className="mt-1 flex gap-2">
          <input
            type="password"
            value={importSeed}
            onChange={(e) => setImportSeed(e.target.value)}
            placeholder="sXXXXXXXX..."
            className={`${inputClass} flex-1`}
          />
          <button
            onClick={handleImport}
            className="rounded-md bg-zinc-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-600"
          >
            Import
          </button>
        </div>
        {importError && <p className={`mt-1 ${errorTextClass}`}>{importError}</p>}
      </div>
    </div>
  );
}
