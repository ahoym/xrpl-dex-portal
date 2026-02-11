"use client";

import { useState } from "react";
import { Wallet } from "xrpl";
import type { WalletInfo, PersistedState } from "@/lib/types";
import { useWalletGeneration } from "@/lib/hooks/use-wallet-generation";
import { ExplorerLink } from "@/app/components/explorer-link";
import { SecretField } from "./secret-field";
import { inputClass, labelClass, errorTextClass, cardClass, primaryButtonClass, dangerButtonClass } from "@/lib/ui/ui";

interface WalletSetupProps {
  wallet: WalletInfo | null;
  network: PersistedState["network"];
  onSetWallet: (wallet: WalletInfo | null) => void;
  children?: React.ReactNode;
}

export function WalletSetup({ wallet, network, onSetWallet, children }: WalletSetupProps) {
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
      <div className={cardClass}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Wallet</h2>
        <div className="mt-3 space-y-1.5 text-sm">
          <p>
            <span className="text-zinc-400 dark:text-zinc-500">Address: </span>
            <ExplorerLink address={wallet.address} />
          </p>
          <SecretField label="Seed" value={wallet.seed} />
          <p className="break-all">
            <span className="text-zinc-400 dark:text-zinc-500">Public Key: </span>
            <span className="font-mono text-xs">{wallet.publicKey}</span>
          </p>
        </div>
        {children}
        <button
          onClick={() => {
            if (window.confirm("Remove wallet? This cannot be undone.")) {
              onSetWallet(null);
            }
          }}
          className={`mt-4 ${dangerButtonClass} px-3 py-1.5 text-xs`}
        >
          Remove Wallet
        </button>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Wallet</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Generate a new wallet or import an existing one via seed.
      </p>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => generate(network, onSetWallet)}
          disabled={generating}
          className={primaryButtonClass}
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

      <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-700">
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
            className="bg-zinc-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-600 active:scale-[0.98]"
          >
            Import
          </button>
        </div>
        {importError && <p className={`mt-1 ${errorTextClass}`}>{importError}</p>}
      </div>
    </div>
  );
}
