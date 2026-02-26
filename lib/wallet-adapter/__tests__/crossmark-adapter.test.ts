import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the @crossmarkio/sdk module before importing the adapter
const mockSignInAndWait = vi.fn();
const mockSignAndSubmitAndWait = vi.fn();
const mockDetect = vi.fn();
const mockIsInstalled = vi.fn();

vi.mock("@crossmarkio/sdk", () => ({
  default: {
    sync: { isInstalled: mockIsInstalled },
    async: {
      detect: mockDetect,
      signInAndWait: mockSignInAndWait,
      signAndSubmitAndWait: mockSignAndSubmitAndWait,
    },
  },
}));

import { CrossmarkAdapter } from "../crossmark-adapter";

describe("CrossmarkAdapter", () => {
  let adapter: CrossmarkAdapter;

  beforeEach(() => {
    adapter = new CrossmarkAdapter();
    vi.clearAllMocks();
  });

  it("has type 'crossmark' and correct displayName", () => {
    expect(adapter.type).toBe("crossmark");
    expect(adapter.displayName).toBe("Crossmark");
  });

  it("isAvailable returns true when extension is installed", async () => {
    mockIsInstalled.mockReturnValue(true);
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("isAvailable returns false when extension is not installed", async () => {
    mockIsInstalled.mockReturnValue(false);
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("isAvailable returns false when SDK throws", async () => {
    mockIsInstalled.mockImplementation(() => {
      throw new Error("no extension");
    });
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("connect calls signInAndWait and returns address/publicKey", async () => {
    mockDetect.mockResolvedValue(true);
    mockSignInAndWait.mockResolvedValue({
      response: {
        data: {
          address: "rCROSSMARK",
          publicKey: "PK_CROSSMARK",
          network: {},
          user: {},
          meta: { isSuccess: true },
        },
      },
    });

    const result = await adapter.connect("testnet");
    expect(result.address).toBe("rCROSSMARK");
    expect(result.publicKey).toBe("PK_CROSSMARK");
    expect(mockDetect).toHaveBeenCalledWith(3000);
    expect(mockSignInAndWait).toHaveBeenCalledOnce();
  });

  it("connect throws if extension not detected", async () => {
    mockDetect.mockResolvedValue(false);
    await expect(adapter.connect("testnet")).rejects.toThrow("not detected");
  });

  it("disconnect clears state", async () => {
    mockDetect.mockResolvedValue(true);
    mockSignInAndWait.mockResolvedValue({
      response: { data: { address: "rADDR", publicKey: "PK", network: {}, user: {}, meta: {} } },
    });
    await adapter.connect("testnet");

    adapter.disconnect();

    // After disconnect, operations should throw
    await expect(
      adapter.sendPayment({
        recipientAddress: "rDEST",
        currencyCode: "XRP",
        amount: "10",
        network: "testnet",
      }),
    ).rejects.toThrow("not connected");
  });

  it("sendPayment builds a Payment tx and signs via SDK", async () => {
    // Connect first
    mockDetect.mockResolvedValue(true);
    mockSignInAndWait.mockResolvedValue({
      response: { data: { address: "rSENDER", publicKey: "PK", network: {}, user: {}, meta: {} } },
    });
    await adapter.connect("testnet");

    // Mock successful sign and submit
    mockSignAndSubmitAndWait.mockResolvedValue({
      response: {
        data: {
          resp: { result: { hash: "TX_HASH_123", meta: { TransactionResult: "tesSUCCESS" } } },
          meta: { isSuccess: true, isRejected: false },
        },
      },
    });

    const result = await adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "10",
      network: "testnet",
    });

    expect(result.hash).toBe("TX_HASH_123");
    expect(result.success).toBe(true);
    expect(result.resultCode).toBe("tesSUCCESS");

    // Verify tx was built correctly
    const tx = mockSignAndSubmitAndWait.mock.calls[0][0];
    expect(tx.TransactionType).toBe("Payment");
    expect(tx.Account).toBe("rSENDER");
    expect(tx.Destination).toBe("rDEST");
    expect(tx.Amount).toBe("10000000"); // 10 XRP in drops
  });

  it("createOffer builds an OfferCreate and signs", async () => {
    mockDetect.mockResolvedValue(true);
    mockSignInAndWait.mockResolvedValue({
      response: { data: { address: "rTRADER", publicKey: "PK", network: {}, user: {}, meta: {} } },
    });
    await adapter.connect("testnet");

    mockSignAndSubmitAndWait.mockResolvedValue({
      response: {
        data: {
          resp: { result: { hash: "OFFER_HASH" } },
          meta: { isSuccess: true, isRejected: false },
        },
      },
    });

    const result = await adapter.createOffer({
      takerGets: { currency: "XRP", value: "100" },
      takerPays: { currency: "USD", issuer: "rISSUER", value: "50" },
      network: "testnet",
    });

    expect(result.hash).toBe("OFFER_HASH");
    expect(result.success).toBe(true);

    const tx = mockSignAndSubmitAndWait.mock.calls[0][0];
    expect(tx.TransactionType).toBe("OfferCreate");
  });

  it("cancelOffer builds an OfferCancel and signs", async () => {
    mockDetect.mockResolvedValue(true);
    mockSignInAndWait.mockResolvedValue({
      response: { data: { address: "rACCOUNT", publicKey: "PK", network: {}, user: {}, meta: {} } },
    });
    await adapter.connect("testnet");

    mockSignAndSubmitAndWait.mockResolvedValue({
      response: {
        data: {
          resp: { result: { hash: "CANCEL_HASH" } },
          meta: { isSuccess: true, isRejected: false },
        },
      },
    });

    const result = await adapter.cancelOffer({ offerSequence: 42, network: "testnet" });
    expect(result.hash).toBe("CANCEL_HASH");

    const tx = mockSignAndSubmitAndWait.mock.calls[0][0];
    expect(tx.TransactionType).toBe("OfferCancel");
    expect(tx.OfferSequence).toBe(42);
  });

  it("setTrustline builds a TrustSet and signs", async () => {
    mockDetect.mockResolvedValue(true);
    mockSignInAndWait.mockResolvedValue({
      response: { data: { address: "rTRUSTER", publicKey: "PK", network: {}, user: {}, meta: {} } },
    });
    await adapter.connect("testnet");

    mockSignAndSubmitAndWait.mockResolvedValue({
      response: {
        data: {
          resp: { result: { hash: "TRUST_HASH" } },
          meta: { isSuccess: true, isRejected: false },
        },
      },
    });

    const result = await adapter.setTrustline({
      address: "rTRUSTER",
      currency: "USD",
      issuer: "rISSUER",
      limit: "1000000",
      network: "testnet",
    });
    expect(result.hash).toBe("TRUST_HASH");

    const tx = mockSignAndSubmitAndWait.mock.calls[0][0];
    expect(tx.TransactionType).toBe("TrustSet");
  });

  it("throws when user rejects signing", async () => {
    mockDetect.mockResolvedValue(true);
    mockSignInAndWait.mockResolvedValue({
      response: { data: { address: "rADDR", publicKey: "PK", network: {}, user: {}, meta: {} } },
    });
    await adapter.connect("testnet");

    mockSignAndSubmitAndWait.mockResolvedValue({
      response: {
        data: {
          resp: {},
          meta: { isSuccess: false, isRejected: true },
        },
      },
    });

    await expect(
      adapter.sendPayment({
        recipientAddress: "rDEST",
        currencyCode: "XRP",
        amount: "1",
        network: "testnet",
      }),
    ).rejects.toThrow("rejected");
  });
});
