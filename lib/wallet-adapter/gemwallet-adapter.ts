/**
 * GemWallet browser extension wallet adapter.
 *
 * Uses @gemwallet/api's purpose-built functions for each transaction type.
 * The API communicates with the GemWallet Chrome extension via
 * injected page globals — no network requests leave the browser.
 */

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
import { buildCredentialAcceptTx, buildCredentialDeleteTx } from "./build-transactions";
import { toXrplAmount } from "../xrpl/currency";
import { encodeXrplCurrency } from "../xrpl/currency";
import { resolveOfferFlags } from "../xrpl/offers";
import { Assets } from "../assets";

type GemWalletApi = typeof import("@gemwallet/api");

let apiPromise: Promise<GemWalletApi> | null = null;

function getApi(): Promise<GemWalletApi> {
  if (!apiPromise) {
    apiPromise = import("@gemwallet/api");
  }
  return apiPromise;
}

export class GemWalletAdapter implements WalletAdapter {
  readonly type = "gemwallet" as const;
  readonly displayName = "GemWallet";

  private address: string | null = null;
  private publicKey: string | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      const api = await getApi();
      const { result } = await api.isInstalled();
      return result.isInstalled === true;
    } catch {
      return false;
    }
  }

  async connect(_network: string): Promise<{ address: string; publicKey: string }> {
    const api = await getApi();

    const pubKeyResp = await api.getPublicKey();
    if (pubKeyResp.type === "reject" || !pubKeyResp.result) {
      throw new Error("GemWallet connection was rejected");
    }

    this.address = pubKeyResp.result.address;
    this.publicKey = pubKeyResp.result.publicKey;

    return { address: this.address, publicKey: this.publicKey };
  }

  disconnect(): void {
    this.address = null;
    this.publicKey = null;
  }

  async sendPayment(params: PaymentParams): Promise<TxResult> {
    this.requireConnected();
    const api = await getApi();

    const isXrp = params.currencyCode === Assets.XRP;
    let amount: string | { currency: string; issuer: string; value: string };
    if (isXrp) {
      amount = params.amount;
    } else {
      if (!params.issuerAddress) {
        throw new Error(`issuerAddress is required for non-XRP currency "${params.currencyCode}"`);
      }
      amount = {
        currency: encodeXrplCurrency(params.currencyCode),
        issuer: params.issuerAddress,
        value: params.amount,
      };
    }

    const request: Parameters<GemWalletApi["sendPayment"]>[0] = {
      amount,
      destination: params.recipientAddress,
    };

    if (params.destinationTag !== undefined) {
      request.destinationTag = params.destinationTag;
    }

    const resp = await api.sendPayment(request);
    return this.parseHashResponse(resp);
  }

  async createOffer(params: CreateOfferParams): Promise<TxResult> {
    this.requireConnected();
    const api = await getApi();

    const request: Parameters<GemWalletApi["createOffer"]>[0] = {
      takerGets: toXrplAmount(params.takerGets),
      takerPays: toXrplAmount(params.takerPays),
    };

    const flags = resolveOfferFlags(params.flags);
    if (flags !== undefined) {
      request.flags = flags;
    }

    if (params.expiration !== undefined) {
      request.expiration = params.expiration;
    }

    const resp = await api.createOffer(request);
    return this.parseHashResponse(resp);
  }

  async cancelOffer(params: CancelOfferParams): Promise<TxResult> {
    this.requireConnected();
    const api = await getApi();

    const resp = await api.cancelOffer({ offerSequence: params.offerSequence });
    return this.parseHashResponse(resp);
  }

  async setTrustline(params: TrustlineParams): Promise<TxResult> {
    this.requireConnected();
    const api = await getApi();

    const resp = await api.setTrustline({
      limitAmount: {
        currency: encodeXrplCurrency(params.currency),
        issuer: params.issuer,
        value: params.limit,
      },
    });
    return this.parseHashResponse(resp);
  }

  async acceptCredential(params: AcceptCredentialParams): Promise<TxResult> {
    this.requireConnected();
    const api = await getApi();
    const tx = buildCredentialAcceptTx(params, this.address!);
    const resp = await api.submitTransaction({
      transaction: tx as Parameters<GemWalletApi["submitTransaction"]>[0]["transaction"],
    });
    return this.parseHashResponse(resp);
  }

  async deleteCredential(params: DeleteCredentialParams): Promise<TxResult> {
    this.requireConnected();
    const api = await getApi();
    const tx = buildCredentialDeleteTx(params, this.address!);
    const resp = await api.submitTransaction({
      transaction: tx as Parameters<GemWalletApi["submitTransaction"]>[0]["transaction"],
    });
    return this.parseHashResponse(resp);
  }

  // ---------- internals ----------

  private requireConnected(): void {
    if (!this.address) {
      throw new Error("GemWallet not connected. Call connect() first.");
    }
  }

  private parseHashResponse(resp: { type: string; result?: { hash: string } }): TxResult {
    if (resp.type === "reject" || !resp.result) {
      throw new Error("Transaction was rejected by the user");
    }
    return {
      hash: resp.result.hash,
      success: true,
    };
  }
}
