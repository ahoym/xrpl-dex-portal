import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsInstalled = vi.fn();
const mockGetPublicKey = vi.fn();
const mockSendPayment = vi.fn();
const mockCreateOffer = vi.fn();
const mockCancelOffer = vi.fn();
const mockSetTrustline = vi.fn();

vi.mock("@gemwallet/api", () => ({
  isInstalled: mockIsInstalled,
  getPublicKey: mockGetPublicKey,
  sendPayment: mockSendPayment,
  createOffer: mockCreateOffer,
  cancelOffer: mockCancelOffer,
  setTrustline: mockSetTrustline,
}));

import { GemWalletAdapter } from "../gemwallet-adapter";

describe("GemWalletAdapter", () => {
  let adapter: GemWalletAdapter;

  beforeEach(() => {
    adapter = new GemWalletAdapter();
    vi.clearAllMocks();
  });

  it("has type 'gemwallet' and correct displayName", () => {
    expect(adapter.type).toBe("gemwallet");
    expect(adapter.displayName).toBe("GemWallet");
  });

  it("isAvailable returns true when extension is installed", async () => {
    mockIsInstalled.mockResolvedValue({ result: { isInstalled: true } });
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("isAvailable returns false when not installed", async () => {
    mockIsInstalled.mockResolvedValue({ result: { isInstalled: false } });
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("connect returns address and publicKey from getPublicKey", async () => {
    mockGetPublicKey.mockResolvedValue({
      type: "response",
      result: { address: "rGEM_ADDR", publicKey: "GEM_PK" },
    });

    const result = await adapter.connect("testnet");
    expect(result.address).toBe("rGEM_ADDR");
    expect(result.publicKey).toBe("GEM_PK");
  });

  it("connect throws when rejected", async () => {
    mockGetPublicKey.mockResolvedValue({ type: "reject" });
    await expect(adapter.connect("testnet")).rejects.toThrow("rejected");
  });

  it("sendPayment calls GemWallet sendPayment", async () => {
    // Connect first
    mockGetPublicKey.mockResolvedValue({
      type: "response",
      result: { address: "rSENDER", publicKey: "PK" },
    });
    await adapter.connect("testnet");

    mockSendPayment.mockResolvedValue({
      type: "response",
      result: { hash: "PAY_HASH" },
    });

    const result = await adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "10",
      network: "testnet",
    });

    expect(result.hash).toBe("PAY_HASH");
    expect(result.success).toBe(true);
    expect(mockSendPayment).toHaveBeenCalledOnce();
    const callArg = mockSendPayment.mock.calls[0][0];
    expect(callArg.destination).toBe("rDEST");
    expect(callArg.amount).toBe("10"); // XRP amount is string for GemWallet
  });

  it("sendPayment includes destinationTag", async () => {
    mockGetPublicKey.mockResolvedValue({
      type: "response",
      result: { address: "rSENDER", publicKey: "PK" },
    });
    await adapter.connect("testnet");

    mockSendPayment.mockResolvedValue({
      type: "response",
      result: { hash: "H" },
    });

    await adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "1",
      destinationTag: 12345,
      network: "testnet",
    });

    expect(mockSendPayment.mock.calls[0][0].destinationTag).toBe(12345);
  });

  it("createOffer calls GemWallet createOffer", async () => {
    mockGetPublicKey.mockResolvedValue({
      type: "response",
      result: { address: "rTRADER", publicKey: "PK" },
    });
    await adapter.connect("testnet");

    mockCreateOffer.mockResolvedValue({
      type: "response",
      result: { hash: "OFFER_HASH" },
    });

    const result = await adapter.createOffer({
      takerGets: { currency: "XRP", value: "100" },
      takerPays: { currency: "USD", issuer: "rISSUER", value: "50" },
      network: "testnet",
    });

    expect(result.hash).toBe("OFFER_HASH");
    expect(result.success).toBe(true);
  });

  it("cancelOffer calls GemWallet cancelOffer", async () => {
    mockGetPublicKey.mockResolvedValue({
      type: "response",
      result: { address: "rACCOUNT", publicKey: "PK" },
    });
    await adapter.connect("testnet");

    mockCancelOffer.mockResolvedValue({
      type: "response",
      result: { hash: "CANCEL_HASH" },
    });

    const result = await adapter.cancelOffer({ offerSequence: 42, network: "testnet" });
    expect(result.hash).toBe("CANCEL_HASH");
    expect(mockCancelOffer.mock.calls[0][0].offerSequence).toBe(42);
  });

  it("setTrustline calls GemWallet setTrustline", async () => {
    mockGetPublicKey.mockResolvedValue({
      type: "response",
      result: { address: "rTRUST", publicKey: "PK" },
    });
    await adapter.connect("testnet");

    mockSetTrustline.mockResolvedValue({
      type: "response",
      result: { hash: "TRUST_HASH" },
    });

    const result = await adapter.setTrustline({
      address: "rTRUST",
      currency: "USD",
      issuer: "rISSUER",
      limit: "1000000",
      network: "testnet",
    });

    expect(result.hash).toBe("TRUST_HASH");
    expect(mockSetTrustline.mock.calls[0][0].limitAmount).toEqual({
      currency: "USD",
      issuer: "rISSUER",
      value: "1000000",
    });
  });

  it("throws when user rejects a transaction", async () => {
    mockGetPublicKey.mockResolvedValue({
      type: "response",
      result: { address: "rADDR", publicKey: "PK" },
    });
    await adapter.connect("testnet");

    mockSendPayment.mockResolvedValue({ type: "reject" });

    await expect(adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "1",
      network: "testnet",
    })).rejects.toThrow("rejected");
  });

  it("throws when not connected", async () => {
    await expect(adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "1",
      network: "testnet",
    })).rejects.toThrow("not connected");
  });
});
