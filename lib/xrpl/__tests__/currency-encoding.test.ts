import { describe, it, expect } from "vitest";
import { encodeXrplCurrency, toXrplAmount, fromXrplAmount } from "../currency";

describe("encodeXrplCurrency", () => {
  it("passes through standard 3-char codes", () => {
    expect(encodeXrplCurrency("USD")).toBe("USD");
    expect(encodeXrplCurrency("XRP")).toBe("XRP");
    expect(encodeXrplCurrency("EUR")).toBe("EUR");
  });

  it("passes through already hex-encoded 40-char codes (uppercased)", () => {
    const hex = "524C555344000000000000000000000000000000";
    expect(encodeXrplCurrency(hex)).toBe(hex);
    // lowercase input gets uppercased
    expect(encodeXrplCurrency(hex.toLowerCase())).toBe(hex);
  });

  it("hex-encodes non-standard 4-char codes with right-padding", () => {
    const result = encodeXrplCurrency("RLUSD");
    expect(result).toHaveLength(40);
    expect(result).toMatch(/^[0-9A-F]+$/);
    // "RLUSD" = R(52) L(4C) U(55) S(53) D(44) → "524C555344" + 30 zeros
    expect(result).toBe("524C555344000000000000000000000000000000");
  });

  it("hex-encodes a 5-char code correctly", () => {
    const result = encodeXrplCurrency("ABCDE");
    // A(41) B(42) C(43) D(44) E(45) → "4142434445"
    expect(result.startsWith("4142434445")).toBe(true);
    expect(result).toHaveLength(40);
  });

  it("handles max-length non-standard code (20 chars)", () => {
    const code = "ABCDEFGHIJKLMNOPQRST"; // 20 chars
    const result = encodeXrplCurrency(code);
    expect(result).toHaveLength(40);
    expect(result).toMatch(/^[0-9A-F]+$/);
  });

  it("throws for codes shorter than 3 chars", () => {
    expect(() => encodeXrplCurrency("AB")).toThrow("at least 3 characters");
    expect(() => encodeXrplCurrency("A")).toThrow("at least 3 characters");
    expect(() => encodeXrplCurrency("")).toThrow("at least 3 characters");
  });

  it("throws for codes between 21 and 39 chars", () => {
    const code = "A".repeat(25);
    expect(() => encodeXrplCurrency(code)).toThrow();
  });
});

describe("toXrplAmount", () => {
  it("converts XRP to drops string", () => {
    expect(toXrplAmount({ currency: "XRP", value: "10" })).toBe("10000000");
  });

  it("converts issued currency to object form", () => {
    const result = toXrplAmount({ currency: "USD", issuer: "rISSUER", value: "50" });
    expect(result).toEqual({ currency: "USD", issuer: "rISSUER", value: "50" });
  });

  it("throws if issued currency is missing issuer", () => {
    expect(() => toXrplAmount({ currency: "USD", value: "50" })).toThrow("issuer is required");
  });
});

describe("fromXrplAmount", () => {
  it("converts drops string to XRP DexAmount", () => {
    const result = fromXrplAmount("10000000");
    expect(result.currency).toBe("XRP");
    expect(result.value).toBe("10");
  });

  it("converts issued currency object to DexAmount", () => {
    const result = fromXrplAmount({ currency: "USD", issuer: "rISSUER", value: "50" });
    expect(result.currency).toBe("USD");
    expect(result.issuer).toBe("rISSUER");
    expect(result.value).toBe("50");
  });
});
