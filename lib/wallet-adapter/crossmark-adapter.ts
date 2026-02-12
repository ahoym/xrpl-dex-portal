/**
 * Crossmark browser extension wallet adapter.
 *
 * Uses @crossmarkio/sdk to sign and submit transactions.
 * The SDK communicates with the Crossmark Chrome extension via
 * injected page globals — no network requests leave the browser.
 */

import type { WalletAdapter, TxResult, PaymentParams, CreateOfferParams, CancelOfferParams, TrustlineParams } from "./types";
import { buildPaymentTx, buildOfferCreateTx, buildOfferCancelTx, buildTrustSetTx } from "./build-transactions";

// Lazy-loaded SDK instance (loaded on first use)
let sdkPromise: Promise<typeof import("@crossmarkio/sdk")["default"]> | null = null;

function getSdk() {
  if (!sdkPromise) {
    sdkPromise = import("@crossmarkio/sdk").then((m) => m.default);
  }
  return sdkPromise;
}

export class CrossmarkAdapter implements WalletAdapter {
  readonly type = "crossmark" as const;
  readonly displayName = "Crossmark";

  private address: string | null = null;
  private publicKey: string | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      const sdk = await getSdk();
      return sdk.sync.isInstalled() === true;
    } catch {
      return false;
    }
  }

  async connect(_network: string): Promise<{ address: string; publicKey: string }> {
    const sdk = await getSdk();

    const detected = await sdk.async.detect(3000);
    if (!detected) {
      throw new Error("Crossmark extension not detected");
    }

    const resp = await sdk.async.signInAndWait();
    const data = resp.response.data;

    if (!data.address || !data.publicKey) {
      throw new Error("Crossmark sign-in did not return address or public key");
    }

    this.address = data.address;
    this.publicKey = data.publicKey;

    return { address: data.address, publicKey: data.publicKey };
  }

  disconnect(): void {
    this.address = null;
    this.publicKey = null;
  }

  async sendPayment(params: PaymentParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildPaymentTx(params, this.address!);
    return this.signAndSubmit(tx);
  }

  async createOffer(params: CreateOfferParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildOfferCreateTx(params, this.address!);
    return this.signAndSubmit(tx);
  }

  async cancelOffer(params: CancelOfferParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildOfferCancelTx(params, this.address!);
    return this.signAndSubmit(tx);
  }

  async setTrustline(params: TrustlineParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildTrustSetTx(params, this.address!);
    return this.signAndSubmit(tx);
  }

  // ---------- internals ----------

  private requireConnected(): void {
    if (!this.address) {
      throw new Error("Crossmark wallet not connected. Call connect() first.");
    }
  }

  private async signAndSubmit(tx: Record<string, unknown>): Promise<TxResult> {
    const sdk = await getSdk();
    const resp = await sdk.async.signAndSubmitAndWait(tx);
    const { meta, resp: txResp } = resp.response.data;

    if (meta.isRejected) {
      throw new Error("Transaction was rejected by the user");
    }

    // txResp is an xrpl TxResponse — hash lives at result.hash
    const hash = (txResp as { result?: { hash?: string } })?.result?.hash ?? "";
    const resultCode = (txResp as { result?: { meta?: { TransactionResult?: string } } })?.result?.meta?.TransactionResult;

    return {
      hash,
      success: meta.isSuccess,
      resultCode: resultCode ?? (meta.isSuccess ? "tesSUCCESS" : undefined),
    };
  }
}
