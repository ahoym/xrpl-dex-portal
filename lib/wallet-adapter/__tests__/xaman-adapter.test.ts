import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthorize = vi.fn();
const mockLogout = vi.fn();
const mockCreateAndSubscribe = vi.fn();
const mockGet = vi.fn();

vi.stubEnv("NEXT_PUBLIC_XUMM_API_KEY", "test-api-key");

vi.mock("xumm", () => ({
  Xumm: class MockXumm {
    authorize = mockAuthorize;
    logout = mockLogout;
    user = { account: Promise.resolve("rXAMAN_ADDR") };
    payload = {
      createAndSubscribe: mockCreateAndSubscribe,
      get: mockGet,
    };
  },
}));

describe("XamanAdapter", () => {
  // Dynamic import to get fresh module state after resetModules
  let XamanAdapter: typeof import("../xaman-adapter").XamanAdapter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adapter: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module registry so the module-level xummInstance singleton starts fresh
    vi.resetModules();
    const mod = await import("../xaman-adapter");
    XamanAdapter = mod.XamanAdapter;
    adapter = new XamanAdapter();
  });

  it("has type 'xaman' and correct displayName", () => {
    expect(adapter.type).toBe("xaman");
    expect(adapter.displayName).toBe("Xaman");
  });

  it("isAvailable returns true when API key is set", async () => {
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("connect calls authorize and returns account", async () => {
    mockAuthorize.mockResolvedValue({ me: { account: "rXAMAN_ADDR" } });

    const result = await adapter.connect("testnet");
    expect(result.address).toBe("rXAMAN_ADDR");
    expect(mockAuthorize).toHaveBeenCalledOnce();
  });

  it("connect throws if authorize fails", async () => {
    mockAuthorize.mockResolvedValue(new Error("Auth failed"));

    await expect(adapter.connect("testnet")).rejects.toThrow("authorization failed");
  });

  it("disconnect clears state", async () => {
    mockAuthorize.mockResolvedValue({});
    await adapter.connect("testnet");

    adapter.disconnect();

    await expect(adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "10",
      network: "testnet",
    })).rejects.toThrow("not connected");
  });

  it("sendPayment creates payload and waits for signing", async () => {
    mockAuthorize.mockResolvedValue({});
    await adapter.connect("testnet");

    const payloadCallback = vi.fn();
    adapter.setPayloadCallback(payloadCallback);

    mockCreateAndSubscribe.mockResolvedValue({
      created: {
        uuid: "payload-uuid",
        refs: { qr_png: "https://xumm.app/qr.png" },
        next: { always: "https://xumm.app/sign/payload-uuid" },
      },
      resolved: Promise.resolve({ signed: true }),
    });

    mockGet.mockResolvedValue({
      response: {
        txid: "XAMAN_TX_HASH",
        dispatched_result: "tesSUCCESS",
      },
    });

    const result = await adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "10",
      network: "testnet",
    });

    expect(result.hash).toBe("XAMAN_TX_HASH");
    expect(result.success).toBe(true);

    // Verify payload callback was called with QR data
    expect(payloadCallback).toHaveBeenCalledWith({
      qrUrl: "https://xumm.app/qr.png",
      deeplink: "https://xumm.app/sign/payload-uuid",
    });

    // Verify callback cleared after completion
    expect(payloadCallback).toHaveBeenLastCalledWith(null);
  });

  it("throws when payload is rejected", async () => {
    mockAuthorize.mockResolvedValue({});
    await adapter.connect("testnet");

    mockCreateAndSubscribe.mockResolvedValue({
      created: {
        uuid: "payload-uuid",
        refs: { qr_png: "https://xumm.app/qr.png" },
        next: { always: "https://xumm.app/sign/payload-uuid" },
      },
      resolved: Promise.resolve({ signed: false }),
    });

    await expect(adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "1",
      network: "testnet",
    })).rejects.toThrow("rejected or expired");
  });

  it("createOffer builds and submits via payload", async () => {
    mockAuthorize.mockResolvedValue({});
    await adapter.connect("testnet");

    mockCreateAndSubscribe.mockResolvedValue({
      created: {
        uuid: "offer-uuid",
        refs: { qr_png: "qr.png" },
        next: { always: "deeplink" },
      },
      resolved: Promise.resolve({ signed: true }),
    });
    mockGet.mockResolvedValue({ response: { txid: "OFFER_HASH", dispatched_result: "tesSUCCESS" } });

    const result = await adapter.createOffer({
      takerGets: { currency: "XRP", value: "100" },
      takerPays: { currency: "USD", issuer: "rI", value: "50" },
      network: "testnet",
    });

    expect(result.hash).toBe("OFFER_HASH");
    const txArg = mockCreateAndSubscribe.mock.calls[0][0];
    expect(txArg.TransactionType).toBe("OfferCreate");
  });
});
