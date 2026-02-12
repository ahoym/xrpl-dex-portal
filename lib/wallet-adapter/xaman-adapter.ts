/**
 * Xaman (Xumm) wallet adapter.
 *
 * Unlike Crossmark/GemWallet (Chrome extensions that inject globals),
 * Xaman is a mobile wallet. Transactions are signed on the phone after
 * scanning a QR code or tapping a deeplink. The `xumm` npm package
 * handles payload creation, QR generation, and WebSocket subscription.
 *
 * Requires `NEXT_PUBLIC_XUMM_API_KEY` environment variable.
 */

import type { WalletAdapter, TxResult, PaymentParams, CreateOfferParams, CancelOfferParams, TrustlineParams } from "./types";
import { buildPaymentTx, buildOfferCreateTx, buildOfferCancelTx, buildTrustSetTx } from "./build-transactions";


type XummSdk = InstanceType<typeof import("xumm").Xumm>;

let xummInstance: XummSdk | null = null;

async function getXumm(): Promise<XummSdk> {
  if (!xummInstance) {
    const apiKey = process.env.NEXT_PUBLIC_XUMM_API_KEY;
    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_XUMM_API_KEY environment variable is not set");
    }
    const { Xumm } = await import("xumm");
    xummInstance = new Xumm(apiKey);
  }
  return xummInstance;
}

export type PayloadCallback = (payload: { qrUrl: string; deeplink: string } | null) => void;

export class XamanAdapter implements WalletAdapter {
  readonly type = "xaman" as const;
  readonly displayName = "Xaman";

  private address: string | null = null;
  private publicKey: string | null = null;
  private payloadCallback: PayloadCallback | null = null;

  /** Set by WalletAdapterProvider to push QR payload state to React. */
  setPayloadCallback(cb: PayloadCallback): void {
    this.payloadCallback = cb;
  }

  async isAvailable(): Promise<boolean> {
    // Xaman is always available if the API key is configured
    return !!process.env.NEXT_PUBLIC_XUMM_API_KEY;
  }

  async connect(_network: string): Promise<{ address: string; publicKey: string }> {
    const xumm = await getXumm();

    const result = await xumm.authorize();
    if (!result || result instanceof Error) {
      throw new Error("Xaman authorization failed");
    }

    const account = await xumm.user.account;
    if (!account) {
      throw new Error("Xaman did not return an account address");
    }

    this.address = account;
    // Xaman doesn't directly expose public key during PKCE auth.
    // Set to empty string since it's not available during connection.
    // The public key can be fetched from XRPL account_info if needed.
    this.publicKey = "";

    return { address: this.address, publicKey: this.publicKey };
  }

  disconnect(): void {
    this.address = null;
    this.publicKey = null;
    this.payloadCallback?.(null);
    // Best-effort logout and clear singleton
    getXumm()
      .then((x) => x.logout())
      .catch(() => {})
      .finally(() => {
        xummInstance = null;
      });
  }

  async sendPayment(params: PaymentParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildPaymentTx(params, this.address!);
    return this.signViaPayload(tx);
  }

  async createOffer(params: CreateOfferParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildOfferCreateTx(params, this.address!);
    return this.signViaPayload(tx);
  }

  async cancelOffer(params: CancelOfferParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildOfferCancelTx(params, this.address!);
    return this.signViaPayload(tx);
  }

  async setTrustline(params: TrustlineParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildTrustSetTx(params, this.address!);
    return this.signViaPayload(tx);
  }

  // ---------- internals ----------

  private requireConnected(): void {
    if (!this.address) {
      throw new Error("Xaman wallet not connected. Call connect() first.");
    }
  }

  private async signViaPayload(tx: Record<string, unknown>): Promise<TxResult> {
    const xumm = await getXumm();
    if (!xumm.payload) {
      throw new Error("Xumm payload API not available");
    }

    const subscription = await xumm.payload.createAndSubscribe(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx as any,
      (event) => {
        // When the payload is signed or rejected, resolve the subscription
        if (typeof event.data === "object" && event.data !== null && "signed" in event.data) {
          return event.data;
        }
      },
    );

    // Emit QR payload to the UI
    if (this.payloadCallback) {
      this.payloadCallback({
        qrUrl: subscription.created.refs.qr_png,
        deeplink: subscription.created.next.always,
      });
    }

    try {
      // Wait for the user to scan and sign on their phone
      const resolveData = await subscription.resolved;

      if (!resolveData || !(resolveData as Record<string, unknown>).signed) {
        throw new Error("Transaction was rejected or expired");
      }

      // Fetch the completed payload for the txid
      const payload = await xumm.payload.get(subscription.created.uuid);
      const txid = payload?.response?.txid ?? "";

      return {
        hash: txid,
        success: !!txid,
        resultCode: payload?.response?.dispatched_result ?? undefined,
      };
    } finally {
      // Clear QR from UI
      this.payloadCallback?.(null);
    }
  }
}
