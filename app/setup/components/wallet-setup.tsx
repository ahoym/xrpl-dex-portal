"use client";

import { useState, useEffect } from "react";
import { Wallet } from "xrpl";
import QRCode from "qrcode";
import type { WalletInfo, PersistedState } from "@/lib/types";
import { useWalletGeneration } from "@/lib/hooks/use-wallet-generation";
import { useWalletAdapter } from "@/lib/hooks/use-wallet-adapter";
import { ExplorerLink } from "@/app/components/explorer-link";
import { SecretField } from "./secret-field";
import { WalletConnector } from "./wallet-connector";
import { inputClass, labelClass, errorTextClass, cardClass, primaryButtonClass, dangerButtonClass } from "@/lib/ui/ui";
import { getWalletLogo, getWalletDisplayName, extractErrorMessage } from "@/lib/wallet-ui";

interface WalletSetupProps {
  wallet: WalletInfo | null;
  network: PersistedState["network"];
  onSetWallet: (wallet: WalletInfo | null) => void;
  children?: React.ReactNode;
}

export function WalletSetup({ wallet, network, onSetWallet, children }: WalletSetupProps) {
  const { loading: generating, error: generateError, generate } = useWalletGeneration();
  const { needsReconnect, connectWallet, connecting, disconnectWallet } = useWalletAdapter();
  const [importSeed, setImportSeed] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundResult, setFundResult] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const hasFaucet = network !== "mainnet";

  useEffect(() => {
    if (showQR && wallet) {
      QRCode.toDataURL(wallet.address, { width: 200, margin: 2 }).then(setQrDataUrl);
    } else {
      setQrDataUrl(null);
    }
  }, [showQR, wallet]);

  async function handleFundFromFaucet() {
    if (!wallet) return;
    setFunding(true);
    setFundResult(null);
    setFundError(null);
    try {
      const res = await fetch(`/api/accounts/${wallet.address}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFundError(data.error ?? "Faucet request failed");
      } else {
        setFundResult(`Funded ${data.amount} XRP`);
      }
    } catch {
      setFundError("Network error — could not reach faucet");
    } finally {
      setFunding(false);
    }
  }

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
        publicKey: w.publicKey,
        type: "seed",
        seed: w.seed!,
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
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 dark:text-zinc-500">Address: </span>
            <ExplorerLink address={wallet.address} />
            <button
              onClick={() => setShowQR((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              title={showQR ? "Hide QR code" : "Show QR code"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <path fillRule="evenodd" d="M3 4.25A1.25 1.25 0 0 1 4.25 3h2.5A1.25 1.25 0 0 1 8 4.25v2.5A1.25 1.25 0 0 1 6.75 8h-2.5A1.25 1.25 0 0 1 3 6.75v-2.5Zm1.5.25v2h2v-2h-2ZM3 13.25A1.25 1.25 0 0 1 4.25 12h2.5A1.25 1.25 0 0 1 8 13.25v2.5A1.25 1.25 0 0 1 6.75 17h-2.5A1.25 1.25 0 0 1 3 15.75v-2.5Zm1.5.25v2h2v-2h-2ZM12 4.25A1.25 1.25 0 0 1 13.25 3h2.5A1.25 1.25 0 0 1 17 4.25v2.5A1.25 1.25 0 0 1 15.75 8h-2.5A1.25 1.25 0 0 1 12 6.75v-2.5Zm1.5.25v2h2v-2h-2ZM12 13.25a1.25 1.25 0 0 1 1-1.22v3.94a1.25 1.25 0 0 1-1-1.22v-1.5ZM14.5 12h1.25A1.25 1.25 0 0 1 17 13.25V14h-2.5v-2ZM14.5 15.5H17v.25A1.25 1.25 0 0 1 15.75 17H14.5v-1.5ZM10 3v2.5h-.5A1.5 1.5 0 0 1 8 4V3h2ZM10 8v2H8V8h2ZM10 12v2H8v-2h2ZM10 16v1H8v-1h2Z" clipRule="evenodd" />
              </svg>
              {showQR ? "Hide QR" : "QR"}
            </button>
          </div>
          {showQR && qrDataUrl && (
            <div className="mt-2">
              <img src={qrDataUrl} alt={`QR code for ${wallet.address}`} width={200} height={200} className="rounded" />
            </div>
          )}
          {wallet.seed && <SecretField label="Seed" value={wallet.seed} />}
          {wallet.publicKey && wallet.publicKey !== wallet.address && (
            <p className="break-all">
              <span className="text-zinc-400 dark:text-zinc-500">Public Key: </span>
              <span className="font-mono text-xs">{wallet.publicKey}</span>
            </p>
          )}
        </div>
        {wallet.type !== "seed" && !needsReconnect && (
          <div className="mt-2 flex items-center gap-1.5">
            <img
              src={getWalletLogo(wallet.type)}
              alt={`${getWalletDisplayName(wallet.type)} logo`}
              className="h-4 w-4"
            />
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              Connected via {getWalletDisplayName(wallet.type)}
            </p>
          </div>
        )}
        {needsReconnect && wallet.type !== "seed" && (
          <div className="mt-3 border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/50">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Wallet session expired. Reconnect to sign transactions.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={async () => {
                  setReconnectError(null);
                  try {
                    await connectWallet(wallet.type, network);
                  } catch (err) {
                    setReconnectError(extractErrorMessage(err, "Reconnection failed"));
                  }
                }}
                disabled={connecting}
                className="bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
              >
                {connecting ? "Reconnecting..." : "Reconnect"}
              </button>
              <button
                onClick={() => disconnectWallet()}
                className={`${dangerButtonClass} px-3 py-1.5 text-xs`}
              >
                Disconnect
              </button>
            </div>
            {reconnectError && <p className={`mt-1 ${errorTextClass}`}>{reconnectError}</p>}
          </div>
        )}
        {hasFaucet && (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleFundFromFaucet}
              disabled={funding}
              className="bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
            >
              {funding ? "Requesting..." : "Fund from Faucet"}
            </button>
            {fundResult && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{fundResult}</span>}
            {fundError && <span className={`text-xs ${errorTextClass}`}>{fundError}</span>}
          </div>
        )}
        {children}
        <button
          onClick={() => {
            const msg = wallet.type === "seed"
              ? "Remove wallet? This cannot be undone."
              : "Disconnect wallet?";
            if (window.confirm(msg)) {
              onSetWallet(null);
            }
          }}
          className={`mt-4 ${dangerButtonClass} px-3 py-1.5 text-xs`}
        >
          {wallet.type === "seed" ? "Remove Wallet" : "Disconnect"}
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
        <WalletConnector network={network} />
      </div>

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
