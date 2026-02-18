"use client";

import { createContext, useContext, useMemo, useCallback, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { WalletType } from "../types";
import type { WalletAdapter, TxResult, PaymentParams, CreateOfferParams, CancelOfferParams, TrustlineParams, AcceptCredentialParams, DeleteCredentialParams } from "../wallet-adapter/types";
import { createSeedAdapter, loadExtensionAdapter } from "../wallet-adapter";
import { useAppState } from "./use-app-state";

export interface XamanPayload {
  qrUrl: string;
  deeplink: string;
}

interface WalletAdapterContextValue {
  /** The currently active adapter (null if no wallet connected). */
  readonly adapter: WalletAdapter | null;
  /** Whether a wallet connection is in progress. */
  readonly connecting: boolean;
  /** True when persisted wallet is an extension type but the adapter session was lost (e.g. page reload). */
  readonly needsReconnect: boolean;
  /** Active Xaman QR payload for signing (null when not signing via Xaman). */
  readonly xamanPayload: XamanPayload | null;

  /** Connect a browser extension wallet. */
  connectWallet(type: WalletType, network: string): Promise<void>;
  /** Disconnect the current extension wallet. */
  disconnectWallet(): void;

  /** Dispatch transaction operations through the active adapter. */
  sendPayment(params: PaymentParams): Promise<TxResult>;
  createOffer(params: CreateOfferParams): Promise<TxResult>;
  cancelOffer(params: CancelOfferParams): Promise<TxResult>;
  setTrustline(params: TrustlineParams): Promise<TxResult>;
  acceptCredential(params: AcceptCredentialParams): Promise<TxResult>;
  deleteCredential(params: DeleteCredentialParams): Promise<TxResult>;
}

const WalletAdapterContext = createContext<WalletAdapterContextValue | null>(null);

export function WalletAdapterProvider({ children }: { children: ReactNode }) {
  const { state, setWallet } = useAppState();
  const [extensionAdapter, setExtensionAdapter] = useState<WalletAdapter | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<XamanPayload | null>(null);
  const prevNetworkRef = useRef(state.network);

  // Disconnect extension wallet when the user switches networks
  useEffect(() => {
    if (prevNetworkRef.current !== state.network && extensionAdapter) {
      extensionAdapter.disconnect();
      setExtensionAdapter(null);
      setXamanPayload(null);
    }
    prevNetworkRef.current = state.network;
  }, [state.network, extensionAdapter]);

  // Detect stale extension wallet after page reload
  const needsReconnect = useMemo(() => {
    const wallet = state.wallet;
    if (!wallet || wallet.type === "seed") return false;
    return extensionAdapter === null;
  }, [state.wallet, extensionAdapter]);

  // Build the active adapter based on wallet type
  const adapter = useMemo<WalletAdapter | null>(() => {
    const wallet = state.wallet;
    if (!wallet) return null;

    if (wallet.type === "seed" && wallet.seed) {
      return createSeedAdapter(() => wallet.seed!);
    }

    // For extension wallets, use the loaded adapter instance
    return extensionAdapter;
  }, [state.wallet, extensionAdapter]);

  const connectWallet = useCallback(
    async (type: WalletType, network: string) => {
      setConnecting(true);
      try {
        const loaded = await loadExtensionAdapter(type);
        const available = await loaded.isAvailable();
        if (!available) {
          throw new Error(`${loaded.displayName} extension is not installed`);
        }

        const { address, publicKey } = await loaded.connect(network);
        setExtensionAdapter(loaded);
        setWallet({ address, publicKey, type });
      } finally {
        setConnecting(false);
      }
    },
    [setWallet],
  );

  const disconnectWallet = useCallback(() => {
    if (extensionAdapter) {
      extensionAdapter.disconnect();
      setExtensionAdapter(null);
    }
    setWallet(null);
    setXamanPayload(null);
  }, [extensionAdapter, setWallet]);

  const requireAdapter = useCallback((): WalletAdapter => {
    if (!adapter) throw new Error("No wallet connected");
    return adapter;
  }, [adapter]);

  const sendPayment = useCallback(
    (params: PaymentParams) => requireAdapter().sendPayment(params),
    [requireAdapter],
  );
  const createOffer = useCallback(
    (params: CreateOfferParams) => requireAdapter().createOffer(params),
    [requireAdapter],
  );
  const cancelOffer = useCallback(
    (params: CancelOfferParams) => requireAdapter().cancelOffer(params),
    [requireAdapter],
  );
  const setTrustline = useCallback(
    (params: TrustlineParams) => requireAdapter().setTrustline(params),
    [requireAdapter],
  );
  const acceptCredential = useCallback(
    (params: AcceptCredentialParams) => requireAdapter().acceptCredential(params),
    [requireAdapter],
  );
  const deleteCredential = useCallback(
    (params: DeleteCredentialParams) => requireAdapter().deleteCredential(params),
    [requireAdapter],
  );

  const value = useMemo<WalletAdapterContextValue>(
    () => ({
      adapter,
      connecting,
      needsReconnect,
      xamanPayload,
      connectWallet,
      disconnectWallet,
      sendPayment,
      createOffer,
      cancelOffer,
      setTrustline,
      acceptCredential,
      deleteCredential,
    }),
    [adapter, connecting, needsReconnect, xamanPayload, connectWallet, disconnectWallet, sendPayment, createOffer, cancelOffer, setTrustline, acceptCredential, deleteCredential],
  );

  // Expose setXamanPayload for the xaman adapter (avoids circular deps)
  useEffect(() => {
    if (adapter && adapter.type === "xaman" && "setPayloadCallback" in adapter) {
      (adapter as WalletAdapter & { setPayloadCallback: (cb: (p: XamanPayload | null) => void) => void })
        .setPayloadCallback(setXamanPayload);
    }
  }, [adapter]);

  return (
    <WalletAdapterContext.Provider value={value}>
      {children}
    </WalletAdapterContext.Provider>
  );
}

export function useWalletAdapter() {
  const ctx = useContext(WalletAdapterContext);
  if (!ctx) throw new Error("useWalletAdapter must be used within WalletAdapterProvider");
  return ctx;
}
