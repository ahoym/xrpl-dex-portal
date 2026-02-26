import { decodeCurrency } from "./decode-currency-client";

describe("decodeCurrency", () => {
  it("passes through short codes unchanged", () => {
    expect(decodeCurrency("XRP")).toBe("XRP");
    expect(decodeCurrency("USD")).toBe("USD");
    expect(decodeCurrency("EUR")).toBe("EUR");
  });

  it("decodes 40-char hex for RLUSD", () => {
    expect(decodeCurrency("524C555344000000000000000000000000000000")).toBe("RLUSD");
  });

  it("decodes 40-char hex for BBRL", () => {
    // "BBRL" = 42 42 52 4C
    expect(
      decodeCurrency(
        "4242524C000000000000000000000000000000000000000000000000000000000000000000000000".slice(
          0,
          40,
        ),
      ),
    ).toBe("BBRL");
    // More precisely: "BBRL" hex-encoded + zero-padded to 40 chars
    const bbrlHex = "4242524C" + "0".repeat(32);
    expect(decodeCurrency(bbrlHex)).toBe("BBRL");
  });

  it("returns original for all-zero 40-char hex", () => {
    const allZeros = "0".repeat(40);
    expect(decodeCurrency(allZeros)).toBe(allZeros);
  });

  it("returns original hex for non-printable bytes", () => {
    // 0x01 is a non-printable control character
    const hexWithControl = "0142524C" + "0".repeat(32);
    expect(decodeCurrency(hexWithControl)).toBe(hexWithControl);
  });

  it("returns original when stripped hex has odd length", () => {
    // After stripping trailing zeros, we get an odd number of hex chars
    // e.g., "ABC" + 37 zeros = 40 chars. stripped = "ABC" (3 chars, odd)
    const oddHex = "ABC" + "0".repeat(37);
    expect(decodeCurrency(oddHex)).toBe(oddHex);
  });

  it("passes through non-40-char strings of various lengths", () => {
    expect(decodeCurrency("A")).toBe("A");
    expect(decodeCurrency("AB")).toBe("AB");
    expect(decodeCurrency("ABCD")).toBe("ABCD");
    expect(decodeCurrency("A".repeat(39))).toBe("A".repeat(39));
    expect(decodeCurrency("A".repeat(41))).toBe("A".repeat(41));
  });

  it("passes through empty string", () => {
    expect(decodeCurrency("")).toBe("");
  });

  it("decodes a longer non-standard currency name", () => {
    // "GateHub" = 47 61 74 65 48 75 62
    const gateHubHex = "4761746548756200000000000000000000000000";
    expect(decodeCurrency(gateHubHex)).toBe("GateHub");
  });

  it("handles 40-char hex that is all non-zero valid printable ASCII", () => {
    // 20 printable ASCII characters encoded as 40 hex chars with no trailing zeros
    // "ABCDEFGHIJKLMNOPQRST" = 20 chars
    const hex = Array.from("ABCDEFGHIJKLMNOPQRST", (ch) => ch.charCodeAt(0).toString(16)).join("");
    expect(hex).toHaveLength(40);
    expect(decodeCurrency(hex)).toBe("ABCDEFGHIJKLMNOPQRST");
  });
});
