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

import type { WalletAdapter, TxResult, PaymentParams, CreateOfferParams, CancelOfferParams, TrustlineParams, AcceptCredentialParams, DeleteCredentialParams } from "./types";
import { buildPaymentTx, buildOfferCreateTx, buildOfferCancelTx, buildTrustSetTx, buildCredentialAcceptTx, buildCredentialDeleteTx } from "./build-transactions";

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

/** Extract a usable Error from MetaMask RPC error objects ({ code, message }) or unknown throws. */
function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    return new Error((err as { message: string }).message);
  }
  return new Error(fallback);
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
    try {
      await ethereum.request({
        method: "wallet_requestSnaps",
        params: { [SNAP_ID]: {} },
      });
    } catch (err) {
      throw toError(err, "Failed to install XRPL Snap");
    }

    // Switch to the requested network (ignore if already on it)
    const chainId = CHAIN_IDS[network];
    if (chainId !== undefined) {
      try {
        await this.invokeSnap(ethereum, "xrpl_changeNetwork", { chainId });
      } catch {
        // Snap throws if already on the requested network — safe to ignore
      }
    }

    // Get account info
    try {
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
    } catch (err) {
      throw toError(err, "Failed to get account from XRPL Snap");
    }
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

  async acceptCredential(params: AcceptCredentialParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildCredentialAcceptTx(params, this.address!);
    return this.signAndSubmit(tx);
  }

  async deleteCredential(params: DeleteCredentialParams): Promise<TxResult> {
    this.requireConnected();
    const tx = buildCredentialDeleteTx(params, this.address!);
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
      const raw = await this.invokeSnap(ethereum, "xrpl_signAndSubmit", tx);

      if (!raw || typeof raw !== "object") {
        throw new Error("MetaMask Snap returned an empty response");
      }

      const resp = raw as Record<string, unknown>;

      // MetaMask may return snap errors as resolved values instead of rejections
      if ("code" in resp && typeof resp.code === "number" && "message" in resp) {
        throw new Error((resp.message as string) || "Transaction failed in MetaMask Snap");
      }

      // The XRPL submit response may arrive wrapped: { result: { engine_result, ... } }
      const inner =
        typeof resp.result === "object" && resp.result !== null
          ? (resp.result as Record<string, unknown>)
          : resp;

      const engineResult = (inner.engine_result as string) ?? (resp.engine_result as string) ?? "";
      const txJson = (inner.tx_json ?? resp.tx_json) as { hash?: string } | undefined;
      const hash = txJson?.hash ?? (inner.hash as string) ?? "";

      if (!engineResult) {
        throw new Error(
          `Unexpected response from MetaMask Snap (keys: ${Object.keys(resp).join(", ")})`,
        );
      }

      return {
        hash,
        success: engineResult === "tesSUCCESS",
        resultCode: engineResult,
      };
    } catch (err: unknown) {
      // MetaMask user rejection is code 4001
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 4001) {
        throw new Error("Transaction was rejected by the user");
      }
      throw toError(err, "Transaction failed");
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
