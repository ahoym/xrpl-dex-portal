/**
 * MetaMask XRPL Snap wallet adapter.
 *
 * Uses the xrpl-snap MetaMask Snap to sign XRPL transactions
 * via the MetaMask extension. Communication happens through
 * `window.ethereum` using `wallet_invokeSnap` JSON-RPC calls.
 *
 * The snap must be installed in MetaMask before use — the adapter
 * triggers installation automatically on connect if needed.
 */

import type { WalletAdapter, TxResult, PaymentParams, CreateOfferParams, CancelOfferParams, TrustlineParams } from "./types";
import { buildPaymentTx, buildOfferCreateTx, buildOfferCancelTx, buildTrustSetTx } from "./build-transactions";

const SNAP_ID = "npm:xrpl-snap";

/** Map portal network names to xrpl-snap chainIds. */
const CHAIN_IDS: Record<string, number> = {
  mainnet: 0,
  testnet: 1,
  devnet: 2,
};

interface EthereumProvider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum;
  return eth?.isMetaMask ? eth : null;
}

export class MetaMaskSnapAdapter implements WalletAdapter {
  readonly type = "metamask-snap" as const;
  readonly displayName = "MetaMask (XRPL)";

  private address: string | null = null;
  private publicKey: string | null = null;

  async isAvailable(): Promise<boolean> {
    return !!getEthereum();
  }

  async connect(network: string): Promise<{ address: string; publicKey: string }> {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error("MetaMask is not installed");
    }

    // Install the snap if not already present
    await ethereum.request({
      method: "wallet_requestSnaps",
      params: { [SNAP_ID]: {} },
    });

    // Switch to the requested network
    const chainId = CHAIN_IDS[network];
    if (chainId !== undefined) {
      await this.invokeSnap(ethereum, "xrpl_changeNetwork", { chainId });
    }

    // Get account info
    const account = (await this.invokeSnap(ethereum, "xrpl_getAccount")) as {
      account: string;
      publicKey: string;
    };

    if (!account?.account) {
      throw new Error("MetaMask Snap did not return an account address");
    }

    this.address = account.account;
    this.publicKey = account.publicKey ?? account.account;

    return { address: this.address, publicKey: this.publicKey };
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
      throw new Error("MetaMask Snap wallet not connected. Call connect() first.");
    }
  }

  private async signAndSubmit(tx: Record<string, unknown>): Promise<TxResult> {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error("MetaMask is not available");
    }

    try {
      const result = (await this.invokeSnap(ethereum, "xrpl_signAndSubmit", tx)) as {
        tx_json?: { hash?: string };
        engine_result?: string;
        engine_result_code?: number;
      };

      const hash = result?.tx_json?.hash ?? "";
      const engineResult = result?.engine_result ?? "";

      return {
        hash,
        success: engineResult === "tesSUCCESS",
        resultCode: engineResult || undefined,
      };
    } catch (err: unknown) {
      // MetaMask user rejection is code 4001
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 4001) {
        throw new Error("Transaction was rejected by the user");
      }
      throw err;
    }
  }

  private async invokeSnap(
    ethereum: EthereumProvider,
    method: string,
    params?: unknown,
  ): Promise<unknown> {
    return ethereum.request({
      method: "wallet_invokeSnap",
      params: {
        snapId: SNAP_ID,
        request: { method, ...(params !== undefined ? { params } : {}) },
      },
    });
  }
}
