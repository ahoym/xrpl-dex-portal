import type { WalletType } from "../types";
import type { DexAmount, OfferFlag } from "../xrpl/types";

export interface TxResult {
  hash: string;
  success: boolean;
  resultCode?: string;
}

export interface PaymentParams {
  recipientAddress: string;
  currencyCode: string;
  amount: string;
  issuerAddress?: string;
  destinationTag?: number;
  network: string;
}

export interface CreateOfferParams {
  takerGets: DexAmount;
  takerPays: DexAmount;
  flags?: OfferFlag[];
  expiration?: number;
  domainID?: string;
  network: string;
}

export interface CancelOfferParams {
  offerSequence: number;
  network: string;
}

export interface TrustlineParams {
  address: string;
  currency: string;
  issuer: string;
  limit: string;
  network: string;
}

export interface AcceptCredentialParams {
  issuer: string;
  credentialType: string;
  network: string;
}

export interface DeleteCredentialParams {
  issuer: string;
  credentialType: string;
  network: string;
}

export interface WalletAdapter {
  readonly type: WalletType;
  readonly displayName: string;

  /** Check if the extension / provider is available in the browser. */
  isAvailable(): Promise<boolean>;

  /** Connect and return the wallet address + public key. */
  connect(network: string): Promise<{ address: string; publicKey: string }>;

  /** Disconnect the wallet. */
  disconnect(): void;

  sendPayment(params: PaymentParams): Promise<TxResult>;
  createOffer(params: CreateOfferParams): Promise<TxResult>;
  cancelOffer(params: CancelOfferParams): Promise<TxResult>;
  setTrustline(params: TrustlineParams): Promise<TxResult>;
  acceptCredential(params: AcceptCredentialParams): Promise<TxResult>;
  deleteCredential(params: DeleteCredentialParams): Promise<TxResult>;
}
