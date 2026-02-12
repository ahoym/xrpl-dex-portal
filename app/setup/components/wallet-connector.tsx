"use client";

import { useState, useEffect } from "react";
import type { WalletType } from "@/lib/types";
import { getExtensionAdapterTypes, loadExtensionAdapter } from "@/lib/wallet-adapter";
import { errorTextClass } from "@/lib/ui/ui";

interface DetectedWallet {
  type: WalletType;
  displayName: string;
  available: boolean;
}

interface WalletConnectorProps {
  network: string;
  onConnected: (info: { address: string; publicKey: string; type: WalletType }) => void;
}

export function WalletConnector({ network, onConnected }: WalletConnectorProps) {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [connecting, setConnecting] = useState<WalletType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      const adapters = getExtensionAdapterTypes();
      const results: DetectedWallet[] = [];
      for (const info of adapters) {
        try {
          const adapter = await info.load().then((Cls) => new Cls());
          const available = await adapter.isAvailable();
          results.push({ type: info.type, displayName: info.displayName, available });
        } catch {
          results.push({ type: info.type, displayName: info.displayName, available: false });
        }
      }
      if (!cancelled) setWallets(results);
    }
    detect();
    return () => { cancelled = true; };
  }, []);

  async function handleConnect(type: WalletType) {
    setConnecting(type);
    setError(null);
    try {
      const adapter = await loadExtensionAdapter(type);
      const { address, publicKey } = await adapter.connect(network);
      onConnected({ address, publicKey, type });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(null);
    }
  }

  if (wallets.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        Browser Wallets
      </p>
      <div className="flex flex-wrap gap-2">
        {wallets.map((w) => (
          <button
            key={w.type}
            onClick={() => handleConnect(w.type)}
            disabled={!w.available || connecting !== null}
            className={`px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.98] ${
              w.available
                ? "bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-md disabled:opacity-50"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600"
            }`}
            title={w.available ? `Connect ${w.displayName}` : `${w.displayName} not detected`}
          >
            {connecting === w.type
              ? "Connecting..."
              : w.available
                ? w.displayName
                : `${w.displayName} (not detected)`}
          </button>
        ))}
      </div>
      {error && <p className={errorTextClass}>{error}</p>}
    </div>
  );
}
