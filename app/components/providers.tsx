"use client";

import { AppStateProvider } from "@/lib/hooks/use-app-state";
import { WalletAdapterProvider, useWalletAdapter } from "@/lib/hooks/use-wallet-adapter";
import { XamanSigningModal } from "./xaman-signing-modal";

function XamanModalBridge({ children }: { children: React.ReactNode }) {
  const { xamanPayload } = useWalletAdapter();
  return (
    <>
      {children}
      {xamanPayload && <XamanSigningModal payload={xamanPayload} />}
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <WalletAdapterProvider>
        <XamanModalBridge>
          {children}
        </XamanModalBridge>
      </WalletAdapterProvider>
    </AppStateProvider>
  );
}
