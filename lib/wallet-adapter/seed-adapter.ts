import type {
  WalletAdapter,
  TxResult,
  PaymentParams,
  CreateOfferParams,
  CancelOfferParams,
  TrustlineParams,
  AcceptCredentialParams,
  DeleteCredentialParams,
} from "./types";

/**
 * Wallet adapter that wraps the existing API routes for seed-based wallets.
 * The seed is provided via a getSeed() closure that reads from app state.
 */
export class SeedWalletAdapter implements WalletAdapter {
  readonly type = "seed" as const;
  readonly displayName = "Seed (Local)";

  private getSeed: () => string;

  constructor(getSeed: () => string) {
    this.getSeed = getSeed;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<{ address: string; publicKey: string }> {
    throw new Error("Seed wallets are imported, not connected via this method");
  }

  disconnect(): void {
    // no-op for seed wallets
  }

  async sendPayment(params: PaymentParams): Promise<TxResult> {
    const payload: Record<string, unknown> = {
      senderSeed: this.getSeed(),
      recipientAddress: params.recipientAddress,
      currencyCode: params.currencyCode,
      amount: params.amount,
      network: params.network,
    };
    if (params.issuerAddress) payload.issuerAddress = params.issuerAddress;
    if (params.destinationTag !== undefined) payload.destinationTag = params.destinationTag;

    return this.postAndParse("/api/transfers", payload);
  }

  async createOffer(params: CreateOfferParams): Promise<TxResult> {
    const payload: Record<string, unknown> = {
      seed: this.getSeed(),
      takerGets: params.takerGets,
      takerPays: params.takerPays,
      network: params.network,
    };
    if (params.flags && params.flags.length > 0) payload.flags = params.flags;
    if (params.expiration !== undefined) payload.expiration = params.expiration;

    return this.postAndParse("/api/dex/offers", payload);
  }

  async cancelOffer(params: CancelOfferParams): Promise<TxResult> {
    return this.postAndParse("/api/dex/offers/cancel", {
      seed: this.getSeed(),
      offerSequence: params.offerSequence,
      network: params.network,
    });
  }

  async setTrustline(params: TrustlineParams): Promise<TxResult> {
    return this.postAndParse(`/api/accounts/${params.address}/trustlines`, {
      seed: this.getSeed(),
      currency: params.currency,
      issuer: params.issuer,
      limit: params.limit,
      network: params.network,
    });
  }

  async acceptCredential(params: AcceptCredentialParams): Promise<TxResult> {
    return this.postAndParse("/api/credentials/accept", {
      seed: this.getSeed(),
      issuer: params.issuer,
      credentialType: params.credentialType,
      network: params.network,
    });
  }

  async deleteCredential(params: DeleteCredentialParams): Promise<TxResult> {
    return this.postAndParse("/api/credentials/delete", {
      seed: this.getSeed(),
      issuer: params.issuer,
      credentialType: params.credentialType,
      network: params.network,
    });
  }

  private async postAndParse(url: string, payload: Record<string, unknown>): Promise<TxResult> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Request failed");
    }

    const hash = data.result?.hash ?? data.result?.tx_json?.hash ?? "";

    // Check engine_result to determine success (may be in meta or at result level)
    const meta = data.result?.meta ?? data.result?.tx_json?.meta;
    const engineResult =
      typeof meta === "string" ? meta : (meta?.TransactionResult ?? data.result?.engine_result);

    const isSuccess = engineResult === "tesSUCCESS" || engineResult === undefined;

    return {
      hash,
      success: isSuccess,
      resultCode: engineResult,
    };
  }
}
