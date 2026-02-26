"use client";

import { useState } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useQRCode } from "@/lib/hooks/use-qr-code";
import { LoadingScreen } from "../components/loading-screen";
import { EmptyWallets } from "../components/empty-wallets";
import { BalanceDisplay } from "../components/balance-display";
import { TransferModal } from "./components/transfer-modal";
import { ContactsManager } from "./components/contacts-manager";
import { ExplorerLink } from "../components/explorer-link";
import { cardClass, primaryButtonClass } from "@/lib/ui/ui";

export default function TransactPage() {
  const { state, hydrated, contacts, addContact, updateContact, removeContact } = useAppState();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const { qrDataUrl } = useQRCode(showQR && state.wallet ? state.wallet.address : null);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (!state.wallet) {
    return <EmptyWallets title="Transact" maxWidth="max-w-4xl" />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Transact
      </h1>

      <div className={`mt-6 ${cardClass}`}>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-400 dark:text-zinc-500">Wallet: </span>
          <ExplorerLink address={state.wallet.address} />
          <button
            onClick={() => setShowQR((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            title={showQR ? "Hide QR code" : "Show QR code"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4"
            >
              <path
                fillRule="evenodd"
                d="M3 4.25A1.25 1.25 0 0 1 4.25 3h2.5A1.25 1.25 0 0 1 8 4.25v2.5A1.25 1.25 0 0 1 6.75 8h-2.5A1.25 1.25 0 0 1 3 6.75v-2.5Zm1.5.25v2h2v-2h-2ZM3 13.25A1.25 1.25 0 0 1 4.25 12h2.5A1.25 1.25 0 0 1 8 13.25v2.5A1.25 1.25 0 0 1 6.75 17h-2.5A1.25 1.25 0 0 1 3 15.75v-2.5Zm1.5.25v2h2v-2h-2ZM12 4.25A1.25 1.25 0 0 1 13.25 3h2.5A1.25 1.25 0 0 1 17 4.25v2.5A1.25 1.25 0 0 1 15.75 8h-2.5A1.25 1.25 0 0 1 12 6.75v-2.5Zm1.5.25v2h2v-2h-2ZM12 13.25a1.25 1.25 0 0 1 1-1.22v3.94a1.25 1.25 0 0 1-1-1.22v-1.5ZM14.5 12h1.25A1.25 1.25 0 0 1 17 13.25V14h-2.5v-2ZM14.5 15.5H17v.25A1.25 1.25 0 0 1 15.75 17H14.5v-1.5ZM10 3v2.5h-.5A1.5 1.5 0 0 1 8 4V3h2ZM10 8v2H8V8h2ZM10 12v2H8v-2h2ZM10 16v1H8v-1h2Z"
                clipRule="evenodd"
              />
            </svg>
            {showQR ? "Hide QR" : "QR"}
          </button>
        </div>
        {showQR && qrDataUrl && (
          <div className="mt-2">
            <img
              src={qrDataUrl}
              alt={`QR code for ${state.wallet.address}`}
              width={200}
              height={200}
              className="rounded"
            />
          </div>
        )}
        <BalanceDisplay address={state.wallet.address} refreshKey={refreshKey} />
        <button onClick={() => setShowTransfer(true)} className={`mt-4 ${primaryButtonClass}`}>
          Send
        </button>
      </div>

      <div className="mt-5">
        <ContactsManager
          contacts={contacts}
          onAdd={addContact}
          onUpdate={updateContact}
          onRemove={removeContact}
        />
      </div>

      {showTransfer && (
        <TransferModal
          sender={state.wallet}
          contacts={contacts}
          onComplete={() => {
            setShowTransfer(false);
            setRefreshKey((k) => k + 1);
          }}
          onClose={() => setShowTransfer(false)}
        />
      )}
    </div>
  );
}
