export interface WalletInfo {
  address: string;
  seed: string;
  publicKey: string;
}

export interface PersistedState {
  network: "devnet" | "testnet" | "mainnet";
  wallet: WalletInfo | null;
}

export interface Contact {
  label: string;
  address: string;
  destinationTag?: number;
}

export interface TrustLine {
  account: string;
  currency: string;
  balance: string;
  limit: string;
}

export interface BalanceEntry {
  currency: string;
  value: string;
  issuer?: string;
}

export interface OrderBookAmount {
  currency: string;
  value: string;
  issuer?: string;
}

export interface OrderBookEntry {
  account: string;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  sequence: number;
}
