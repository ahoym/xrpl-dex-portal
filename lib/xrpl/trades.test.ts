import { describe, it, expect } from "vitest";
import { tradesCacheKey, amountCurrency } from "./trades";

describe("tradesCacheKey", () => {
  it("formats key with XRP base (no issuer) and token quote", () => {
    const key = tradesCacheKey(
      "mainnet",
      "XRP",
      undefined,
      "USD",
      "rIssuerAddress123",
    );
    expect(key).toBe("mainnet:XRP::USD:rIssuerAddress123");
  });

  it("formats key with token base and XRP quote (no issuer)", () => {
    const key = tradesCacheKey(
      "testnet",
      "RLUSD",
      "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV",
      "XRP",
      undefined,
    );
    expect(key).toBe(
      "testnet:RLUSD:rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV:XRP:",
    );
  });

  it("formats key with both token base and token quote (both have issuers)", () => {
    const key = tradesCacheKey(
      "mainnet",
      "RLUSD",
      "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
      "BBRL",
      "rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt",
    );
    expect(key).toBe(
      "mainnet:RLUSD:rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De:BBRL:rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt",
    );
  });

  it("formats key with both sides as XRP (both issuers undefined)", () => {
    const key = tradesCacheKey("devnet", "XRP", undefined, "XRP", undefined);
    expect(key).toBe("devnet:XRP::XRP:");
  });

  it("produces empty strings for undefined issuers", () => {
    const key = tradesCacheKey(
      "mainnet",
      "USD",
      undefined,
      "EUR",
      undefined,
    );
    // Both issuer slots should be empty strings
    expect(key).toBe("mainnet:USD::EUR:");
    const parts = key.split(":");
    expect(parts).toEqual(["mainnet", "USD", "", "EUR", ""]);
  });

  it("includes the network in the key", () => {
    const keyA = tradesCacheKey("mainnet", "XRP", undefined, "USD", "rIssuer");
    const keyB = tradesCacheKey("testnet", "XRP", undefined, "USD", "rIssuer");
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain("mainnet");
    expect(keyB).toContain("testnet");
  });
});

describe("amountCurrency", () => {
  it('returns { currency: "XRP" } for a string amount (XRP drops)', () => {
    const result = amountCurrency("1000000");
    expect(result).toEqual({ currency: "XRP" });
  });

  it('returns { currency: "XRP" } for any string value (drops are always XRP)', () => {
    const result = amountCurrency("0");
    expect(result).toEqual({ currency: "XRP" });
  });

  it("returns decoded currency and issuer for an object amount with standard 3-char code", () => {
    const result = amountCurrency({
      currency: "USD",
      issuer: "rXXXissuerAddress",
      value: "100.50",
    });
    expect(result).toEqual({ currency: "USD", issuer: "rXXXissuerAddress" });
  });

  it("returns the 3-char code as-is without decoding", () => {
    const result = amountCurrency({
      currency: "EUR",
      issuer: "rEURissuer",
      value: "50",
    });
    expect(result.currency).toBe("EUR");
    expect(result.issuer).toBe("rEURissuer");
  });

  it("decodes hex-encoded currency (RLUSD) to readable name", () => {
    // RLUSD hex-encoded: R=52, L=4C, U=55, S=53, D=44, padded to 40 chars
    const rlusdHex = "524C555344000000000000000000000000000000";
    const result = amountCurrency({
      currency: rlusdHex,
      issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
      value: "1000",
    });
    expect(result).toEqual({
      currency: "RLUSD",
      issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
    });
  });

  it("decodes another hex-encoded currency (BBRL)", () => {
    // BBRL hex-encoded: B=42, B=42, R=52, L=4C, padded to 40 chars
    const bbrlHex = "4242524C000000000000000000000000000000" + "00";
    const result = amountCurrency({
      currency: bbrlHex,
      issuer: "rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt",
      value: "500",
    });
    expect(result).toEqual({
      currency: "BBRL",
      issuer: "rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt",
    });
  });

  it("does not include issuer property for XRP string amounts", () => {
    const result = amountCurrency("12000");
    expect(result).not.toHaveProperty("issuer");
  });

  it("includes issuer for object amounts even if undefined in source", () => {
    // XRPL Amount objects always have issuer for tokens, but testing the pass-through
    const result = amountCurrency({
      currency: "USD",
      issuer: undefined as unknown as string,
      value: "10",
    });
    expect(result.currency).toBe("USD");
    expect(result.issuer).toBeUndefined();
  });
});
