import { describe, it, expect, vi, beforeEach } from "vitest";
import { MetaMaskSnapAdapter } from "../metamask-snap-adapter";

const mockRequest = vi.fn();

// Simulate window.ethereum
beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    ethereum: { isMetaMask: true, request: mockRequest },
  };
});

describe("MetaMaskSnapAdapter", () => {
  let adapter: MetaMaskSnapAdapter;

  beforeEach(() => {
    adapter = new MetaMaskSnapAdapter();
  });

  it("has type 'metamask-snap' and correct displayName", () => {
    expect(adapter.type).toBe("metamask-snap");
    expect(adapter.displayName).toBe("MetaMask (XRPL)");
  });

  it("isAvailable returns true when window.ethereum exists", async () => {
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("isAvailable returns false when no MetaMask", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = {};
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("connect installs snap, switches network, and returns account", async () => {
    mockRequest
      // wallet_requestSnaps
      .mockResolvedValueOnce({ "npm:xrpl-snap": { id: "npm:xrpl-snap", version: "1.0.3" } })
      // xrpl_changeNetwork
      .mockResolvedValueOnce({ chainId: 1, name: "Testnet" })
      // xrpl_getAccount
      .mockResolvedValueOnce({ account: "rMETAMASK_ADDR", publicKey: "EDPUBKEY123" });

    const result = await adapter.connect("testnet");

    expect(result.address).toBe("rMETAMASK_ADDR");
    expect(result.publicKey).toBe("EDPUBKEY123");

    // Verify snap installation was requested
    expect(mockRequest).toHaveBeenCalledWith({
      method: "wallet_requestSnaps",
      params: { "npm:xrpl-snap": {} },
    });

    // Verify network switch
    expect(mockRequest).toHaveBeenCalledWith({
      method: "wallet_invokeSnap",
      params: {
        snapId: "npm:xrpl-snap",
        request: { method: "xrpl_changeNetwork", params: { chainId: 1 } },
      },
    });
  });

  it("connect throws when MetaMask is not installed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = {};
    await expect(adapter.connect("testnet")).rejects.toThrow("MetaMask is not installed");
  });

  it("connect throws when snap returns no account", async () => {
    mockRequest
      .mockResolvedValueOnce({}) // wallet_requestSnaps
      .mockResolvedValueOnce({}) // xrpl_changeNetwork
      .mockResolvedValueOnce({}); // xrpl_getAccount with no account

    await expect(adapter.connect("testnet")).rejects.toThrow("did not return an account");
  });

  it("disconnect clears state", async () => {
    mockRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ account: "rADDR", publicKey: "PK" });
    await adapter.connect("testnet");

    adapter.disconnect();

    await expect(
      adapter.sendPayment({
        recipientAddress: "rDEST",
        currencyCode: "XRP",
        amount: "10",
        network: "testnet",
      }),
    ).rejects.toThrow("not connected");
  });

  it("sendPayment signs and submits via snap", async () => {
    // Connect first
    mockRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ account: "rADDR", publicKey: "PK" });
    await adapter.connect("testnet");

    // sendPayment call
    mockRequest.mockResolvedValueOnce({
      tx_json: { hash: "SNAP_TX_HASH" },
      engine_result: "tesSUCCESS",
    });

    const result = await adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "10",
      network: "testnet",
    });

    expect(result.hash).toBe("SNAP_TX_HASH");
    expect(result.success).toBe(true);
    expect(result.resultCode).toBe("tesSUCCESS");
  });

  it("createOffer builds tx and submits via snap", async () => {
    mockRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ account: "rADDR", publicKey: "PK" });
    await adapter.connect("testnet");

    mockRequest.mockResolvedValueOnce({
      tx_json: { hash: "OFFER_HASH" },
      engine_result: "tesSUCCESS",
    });

    const result = await adapter.createOffer({
      takerGets: { currency: "XRP", value: "100" },
      takerPays: { currency: "USD", issuer: "rI", value: "50" },
      network: "testnet",
    });

    expect(result.hash).toBe("OFFER_HASH");
    expect(result.success).toBe(true);

    // Verify the snap call was xrpl_signAndSubmit
    const snapCall = mockRequest.mock.calls[3]; // 4th call (after connect's 3 calls)
    expect(snapCall[0].params.request.method).toBe("xrpl_signAndSubmit");
    const tx = snapCall[0].params.request.params;
    expect(tx.TransactionType).toBe("OfferCreate");
  });

  it("cancelOffer submits OfferCancel via snap", async () => {
    mockRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ account: "rADDR", publicKey: "PK" });
    await adapter.connect("testnet");

    mockRequest.mockResolvedValueOnce({
      tx_json: { hash: "CANCEL_HASH" },
      engine_result: "tesSUCCESS",
    });

    const result = await adapter.cancelOffer({
      offerSequence: 42,
      network: "testnet",
    });

    expect(result.hash).toBe("CANCEL_HASH");
    const tx = mockRequest.mock.calls[3][0].params.request.params;
    expect(tx.TransactionType).toBe("OfferCancel");
    expect(tx.OfferSequence).toBe(42);
  });

  it("setTrustline submits TrustSet via snap", async () => {
    mockRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ account: "rADDR", publicKey: "PK" });
    await adapter.connect("testnet");

    mockRequest.mockResolvedValueOnce({
      tx_json: { hash: "TRUST_HASH" },
      engine_result: "tesSUCCESS",
    });

    const result = await adapter.setTrustline({
      address: "rADDR",
      currency: "USD",
      issuer: "rISSUER",
      limit: "1000000",
      network: "testnet",
    });

    expect(result.hash).toBe("TRUST_HASH");
    const tx = mockRequest.mock.calls[3][0].params.request.params;
    expect(tx.TransactionType).toBe("TrustSet");
  });

  it("throws user-friendly message on rejection (code 4001)", async () => {
    mockRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ account: "rADDR", publicKey: "PK" });
    await adapter.connect("testnet");

    mockRequest.mockRejectedValueOnce({ code: 4001, message: "User rejected" });

    await expect(
      adapter.sendPayment({
        recipientAddress: "rDEST",
        currencyCode: "XRP",
        amount: "1",
        network: "testnet",
      }),
    ).rejects.toThrow("rejected by the user");
  });
});
