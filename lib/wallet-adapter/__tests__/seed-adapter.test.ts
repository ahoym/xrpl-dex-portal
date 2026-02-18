import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeedWalletAdapter } from "../seed-adapter";

describe("SeedWalletAdapter", () => {
  let adapter: SeedWalletAdapter;
  const mockSeed = "sEdTESTSEED123";

  beforeEach(() => {
    adapter = new SeedWalletAdapter(() => mockSeed);
    vi.restoreAllMocks();
  });

  it("has type 'seed' and correct displayName", () => {
    expect(adapter.type).toBe("seed");
    expect(adapter.displayName).toBe("Seed (Local)");
  });

  it("isAvailable always returns true", async () => {
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("connect throws (seed wallets are imported, not connected)", async () => {
    await expect(adapter.connect("testnet")).rejects.toThrow("imported");
  });

  it("disconnect is a no-op", () => {
    expect(() => adapter.disconnect()).not.toThrow();
  });

  it("sendPayment calls /api/transfers with correct payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { hash: "TX_HASH_1" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "10",
      network: "testnet",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/transfers");
    const body = JSON.parse(options.body);
    expect(body.senderSeed).toBe(mockSeed);
    expect(body.recipientAddress).toBe("rDEST");
    expect(body.currencyCode).toBe("XRP");
    expect(body.amount).toBe("10");
    expect(body.network).toBe("testnet");
    expect(result.hash).toBe("TX_HASH_1");
    expect(result.success).toBe(true);
  });

  it("sendPayment includes optional issuerAddress and destinationTag", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { hash: "H" } }),
    }));

    await adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "USD",
      amount: "50",
      issuerAddress: "rISSUER",
      destinationTag: 12345,
      network: "testnet",
    });

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.issuerAddress).toBe("rISSUER");
    expect(body.destinationTag).toBe(12345);
  });

  it("createOffer calls /api/dex/offers with correct payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { hash: "OFFER_HASH" } }),
    }));

    const result = await adapter.createOffer({
      takerGets: { currency: "XRP", value: "100" },
      takerPays: { currency: "USD", issuer: "rISSUER", value: "50" },
      flags: ["passive"],
      expiration: 700000000,
      network: "testnet",
    });

    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/dex/offers");
    const body = JSON.parse(options.body);
    expect(body.seed).toBe(mockSeed);
    expect(body.takerGets).toEqual({ currency: "XRP", value: "100" });
    expect(body.flags).toEqual(["passive"]);
    expect(body.expiration).toBe(700000000);
    expect(result.hash).toBe("OFFER_HASH");
  });

  it("cancelOffer calls /api/dex/offers/cancel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { hash: "CANCEL_HASH" } }),
    }));

    const result = await adapter.cancelOffer({
      offerSequence: 42,
      network: "testnet",
    });

    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/dex/offers/cancel");
    const body = JSON.parse(options.body);
    expect(body.seed).toBe(mockSeed);
    expect(body.offerSequence).toBe(42);
    expect(result.hash).toBe("CANCEL_HASH");
  });

  it("setTrustline calls /api/accounts/{address}/trustlines", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { hash: "TRUST_HASH" } }),
    }));

    const result = await adapter.setTrustline({
      address: "rMYADDR",
      currency: "USD",
      issuer: "rISSUER",
      limit: "1000000",
      network: "testnet",
    });

    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/accounts/rMYADDR/trustlines");
    const body = JSON.parse(options.body);
    expect(body.seed).toBe(mockSeed);
    expect(body.currency).toBe("USD");
    expect(body.issuer).toBe("rISSUER");
    expect(body.limit).toBe("1000000");
    expect(result.hash).toBe("TRUST_HASH");
  });

  it("acceptCredential calls /api/credentials/accept with correct payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { hash: "ACCEPT_HASH" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.acceptCredential({
      issuer: "rISSUER",
      credentialType: "KYC",
      network: "testnet",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/credentials/accept");
    const body = JSON.parse(options.body);
    expect(body.seed).toBe(mockSeed);
    expect(body.issuer).toBe("rISSUER");
    expect(body.credentialType).toBe("KYC");
    expect(body.network).toBe("testnet");
    expect(result.hash).toBe("ACCEPT_HASH");
    expect(result.success).toBe(true);
  });

  it("deleteCredential calls /api/credentials/delete with correct payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { hash: "DELETE_HASH" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await adapter.deleteCredential({
      issuer: "rISSUER",
      credentialType: "KYC",
      network: "testnet",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/credentials/delete");
    const body = JSON.parse(options.body);
    expect(body.seed).toBe(mockSeed);
    expect(body.issuer).toBe("rISSUER");
    expect(body.credentialType).toBe("KYC");
    expect(body.network).toBe("testnet");
    expect(result.hash).toBe("DELETE_HASH");
    expect(result.success).toBe(true);
  });

  it("throws on API error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Insufficient balance" }),
    }));

    await expect(adapter.sendPayment({
      recipientAddress: "rDEST",
      currencyCode: "XRP",
      amount: "10",
      network: "testnet",
    })).rejects.toThrow("Insufficient balance");
  });
});
