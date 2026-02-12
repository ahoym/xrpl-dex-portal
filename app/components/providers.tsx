"use client";

import { AppStateProvider } from "@/lib/hooks/use-app-state";
import { WalletAdapterProvider } from "@/lib/hooks/use-wallet-adapter";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <WalletAdapterProvider>
        {children}
      </WalletAdapterProvider>
    </AppStateProvider>
  );
}
