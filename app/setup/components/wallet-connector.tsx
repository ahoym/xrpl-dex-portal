"use client";

import { useState, useEffect } from "react";
import type { WalletType } from "@/lib/types";
import { getExtensionAdapterTypes, loadExtensionAdapter } from "@/lib/wallet-adapter";
import { useWalletAdapter } from "@/lib/hooks/use-wallet-adapter";
import { errorTextClass } from "@/lib/ui/ui";

interface DetectedWallet {
  type: WalletType;
  displayName: string;
  available: boolean;
}

interface WalletConnectorProps {
  network: string;
}

function getWalletLogo(type: WalletType): string {
  // Map wallet type to logo filename
  const logoMap: Record<WalletType, string> = {
    seed: "",
    crossmark: "crossmark",
    gemwallet: "gemwallet",
    xaman: "xaman",
    "metamask-snap": "metamask",
  };
  return logoMap[type] ? `/wallets/${logoMap[type]}.svg` : "";
}

export function WalletConnector({ network }: WalletConnectorProps) {
  const { connectWallet, connecting } = useWalletAdapter();
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [connectingType, setConnectingType] = useState<WalletType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      const adapters = getExtensionAdapterTypes();
      const results = await Promise.allSettled(
        adapters.map(async (info) => {
          const Cls = await info.load();
          const adapter = new Cls();
          const available = await adapter.isAvailable();
          return { type: info.type, displayName: info.displayName, available };
        })
      );

      if (!cancelled) {
        setWallets(
          results.map((r, i) =>
            r.status === "fulfilled"
              ? r.value
              : { type: adapters[i].type, displayName: adapters[i].displayName, available: false }
          )
        );
      }
    }
    detect();
    return () => { cancelled = true; };
  }, []);

  async function handleConnect(type: WalletType) {
    setConnectingType(type);
    setError(null);
    try {
      await connectWallet(type, network);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnectingType(null);
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
            disabled={!w.available || connecting || connectingType !== null}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.98] ${
              w.available
                ? "bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-md disabled:opacity-50"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600"
            }`}
            title={w.available ? `Connect ${w.displayName}` : `${w.displayName} not detected`}
          >
            <img
              src={getWalletLogo(w.type)}
              alt={`${w.displayName} logo`}
              className="h-5 w-5"
            />
            {connectingType === w.type
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
