"use client";

import { useState } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
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

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (!state.wallet) {
    return <EmptyWallets title="Transfer" maxWidth="max-w-4xl" />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Transfer</h1>

      <div className={`mt-6 ${cardClass}`}>
        <p className="text-sm">
          <span className="text-zinc-400 dark:text-zinc-500">Wallet: </span>
          <ExplorerLink address={state.wallet.address} />
        </p>
        <BalanceDisplay address={state.wallet.address} refreshKey={refreshKey} />
        <button
          onClick={() => setShowTransfer(true)}
          className={`mt-4 ${primaryButtonClass}`}
        >
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
