"use client";

import { useState } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { LoadingScreen } from "../components/loading-screen";
import { SecurityWarning } from "./components/security-warning";
import { WalletSetup } from "./components/wallet-setup";
import { TrustLineManagement } from "./components/trust-line-management";
import { CredentialManagement } from "./components/credential-management";
import { ErrorBoundary } from "./components/error-boundary";
import { DataManagement } from "./components/data-management";
import { cardClass, errorTextClass } from "@/lib/ui/ui";
import { BalanceDisplay } from "../components/balance-display";

export default function SetupPage() {
  const { state, hydrated, contacts, setWallet, importState, clearAll } = useAppState();

  const [refreshKey, setRefreshKey] = useState(0);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Setup</h1>

      <div className="mt-6 space-y-5">
        <WalletSetup wallet={state.wallet} network={state.network} onSetWallet={setWallet}>
          {state.wallet && (
            <BalanceDisplay address={state.wallet.address} refreshKey={refreshKey} />
          )}
        </WalletSetup>

        {state.wallet && (
          <TrustLineManagement
            wallet={state.wallet}
            network={state.network}
            refreshKey={refreshKey}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        )}

        {state.wallet && (
          <ErrorBoundary
            fallback={
              <div className={cardClass}>
                <p className={errorTextClass}>Failed to load credentials section.</p>
              </div>
            }
          >
            <CredentialManagement
              wallet={state.wallet}
              network={state.network}
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          </ErrorBoundary>
        )}
      </div>

      <div className="mt-8 space-y-5">
        <SecurityWarning network={state.network} />
        <DataManagement
          state={state}
          contacts={contacts}
          onImport={importState}
          onClear={clearAll}
        />
      </div>
    </div>
  );
}
