"use client";

import { useState } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { LoadingScreen } from "../components/loading-screen";
import { EmptyWallets } from "../components/empty-wallets";
import { BalanceDisplay } from "../components/balance-display";
import { TransferModal } from "./components/transfer-modal";
import { ContactsManager } from "./components/contacts-manager";
import { ExplorerLink } from "../components/explorer-link";

export default function TransactPage() {
  const { state, hydrated, contacts, addContact, updateContact, removeContact } = useAppState();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTransfer, setShowTransfer] = useState(false);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (!state.wallet) {
    return <EmptyWallets title="Transfer" maxWidth="max-w-4xl" />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Transfer</h1>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Wallet: </span>
          <ExplorerLink address={state.wallet.address} />
        </p>
        <BalanceDisplay address={state.wallet.address} refreshKey={refreshKey} />
        <button
          onClick={() => setShowTransfer(true)}
          className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          Send
        </button>
      </div>

      <div className="mt-6">
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
