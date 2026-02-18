export type WalletType = "seed" | "crossmark" | "gemwallet" | "xaman" | "metamask-snap";

export interface WalletInfo {
  address: string;
  publicKey: string;
  type: WalletType;
  seed?: string;
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
  taker_gets_funded?: OrderBookAmount;
  taker_pays_funded?: OrderBookAmount;
  quality: string;
  sequence: number;
}

export interface DepthSummary {
  bidVolume: string;   // total bid volume in quote currency
  bidLevels: number;   // number of bid levels in full scan
  askVolume: string;   // total ask volume in base currency
  askLevels: number;   // number of ask levels in full scan
}

export interface CredentialInfo {
  issuer: string;
  credentialType: string;
  accepted: boolean;
  expiresAtMs?: number;
  uri?: string;
}
