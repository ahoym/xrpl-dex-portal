import { matchesCurrency } from "./match-currency";

describe("matchesCurrency", () => {
  it("matches XRP regardless of issuer", () => {
    expect(matchesCurrency({ currency: "XRP" }, "XRP", undefined)).toBe(true);
    expect(matchesCurrency({ currency: "XRP", issuer: "rSomeAddress" }, "XRP", undefined)).toBe(
      true,
    );
  });

  it("matches token with matching currency + issuer", () => {
    expect(matchesCurrency({ currency: "USD", issuer: "rIssuer1" }, "USD", "rIssuer1")).toBe(true);
  });

  it("does not match token with wrong issuer", () => {
    expect(matchesCurrency({ currency: "USD", issuer: "rIssuer1" }, "USD", "rIssuer2")).toBe(false);
  });

  it("does not match different currency", () => {
    expect(matchesCurrency({ currency: "EUR", issuer: "rIssuer1" }, "USD", "rIssuer1")).toBe(false);
  });

  it("handles hex-encoded currency codes", () => {
    // "RLUSD" encoded as 40-char hex (right-padded with zeros)
    const hexRLUSD = "524C555344000000000000000000000000000000";
    expect(matchesCurrency({ currency: hexRLUSD, issuer: "rIssuer1" }, "RLUSD", "rIssuer1")).toBe(
      true,
    );
  });

  it("matches raw hex currency code without decoding", () => {
    const hexCode = "524C555344000000000000000000000000000000";
    expect(matchesCurrency({ currency: hexCode, issuer: "rIssuer1" }, hexCode, "rIssuer1")).toBe(
      true,
    );
  });
});
