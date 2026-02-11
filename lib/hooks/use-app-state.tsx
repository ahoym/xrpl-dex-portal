"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useLocalStorage } from "./use-local-storage";
import type { PersistedState, WalletInfo, Contact } from "../types";

const NETWORK_KEY = "xrpl-dex-portal-network";

function stateKey(network: PersistedState["network"]) {
  return `xrpl-dex-portal-state-${network}`;
}

function contactsKey(network: PersistedState["network"]) {
  return `xrpl-dex-portal-contacts-${network}`;
}

interface NetworkData {
  wallet: WalletInfo | null;
}

const DEFAULT_NETWORK_DATA: NetworkData = {
  wallet: null,
};

function readNetwork(): PersistedState["network"] {
  try {
    const stored = localStorage.getItem(NETWORK_KEY);
    if (stored === "testnet" || stored === "devnet" || stored === "mainnet") return stored;
  } catch {
    // ignore
  }
  return "testnet";
}

interface AppStateValue {
  readonly state: PersistedState;
  readonly hydrated: boolean;
  readonly contacts: Contact[];
  readonly setNetwork: (network: PersistedState["network"]) => void;
  readonly setWallet: (wallet: WalletInfo | null) => void;
  readonly addContact: (contact: Contact) => void;
  readonly updateContact: (index: number, contact: Contact) => void;
  readonly removeContact: (index: number) => void;
  readonly setContacts: (contacts: Contact[]) => void;
  readonly importState: (imported: { network: PersistedState["network"]; wallet: WalletInfo | null; contacts?: Contact[] }) => void;
  readonly clearAll: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkRaw] = useState<PersistedState["network"]>(readNetwork);

  const {
    value: networkData,
    set: setNetworkData,
    remove: removeNetworkData,
    hydrated,
  } = useLocalStorage<NetworkData>(stateKey(network), DEFAULT_NETWORK_DATA);

  const {
    value: contacts,
    set: setContactsRaw,
    remove: removeContacts,
  } = useLocalStorage<Contact[]>(contactsKey(network), []);

  const state: PersistedState = {
    network,
    wallet: networkData.wallet ?? null,
  };

  const setNetwork = useCallback(
    (next: PersistedState["network"]) => {
      setNetworkRaw(next);
      try {
        localStorage.setItem(NETWORK_KEY, next);
      } catch {
        // ignore
      }
    },
    [],
  );

  const setWallet = useCallback(
    (wallet: WalletInfo | null) => {
      setNetworkData((prev) => ({ ...prev, wallet }));
    },
    [setNetworkData],
  );

  const addContact = useCallback(
    (contact: Contact) => {
      setContactsRaw((prev) => [...prev, contact]);
    },
    [setContactsRaw],
  );

  const updateContact = useCallback(
    (index: number, contact: Contact) => {
      setContactsRaw((prev) => {
        const next = [...prev];
        next[index] = contact;
        return next;
      });
    },
    [setContactsRaw],
  );

  const removeContact = useCallback(
    (index: number) => {
      setContactsRaw((prev) => prev.filter((_, i) => i !== index));
    },
    [setContactsRaw],
  );

  const setContacts = useCallback(
    (next: Contact[]) => {
      setContactsRaw(next);
    },
    [setContactsRaw],
  );

  const importState = useCallback(
    (imported: { network: PersistedState["network"]; wallet: WalletInfo | null; contacts?: Contact[] }) => {
      const importedNetwork = imported.network;
      const data: NetworkData = { wallet: imported.wallet };
      const importedContacts = imported.contacts ?? [];
      try {
        localStorage.setItem(stateKey(importedNetwork), JSON.stringify(data));
        localStorage.setItem(contactsKey(importedNetwork), JSON.stringify(importedContacts));
        localStorage.setItem(NETWORK_KEY, importedNetwork);
      } catch {
        // ignore
      }
      if (importedNetwork === network) {
        setNetworkData(data);
        setContactsRaw(importedContacts);
      } else {
        setNetworkRaw(importedNetwork);
      }
    },
    [network, setNetworkData, setContactsRaw],
  );

  const clearAll = useCallback(() => {
    removeNetworkData();
    removeContacts();
  }, [removeNetworkData, removeContacts]);

  const value: AppStateValue = {
    state,
    hydrated,
    contacts,
    setNetwork,
    setWallet,
    addContact,
    updateContact,
    removeContact,
    setContacts,
    importState,
    clearAll,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
