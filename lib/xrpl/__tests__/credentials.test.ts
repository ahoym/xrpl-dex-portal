import { describe, it, expect } from "vitest";
import { encodeCredentialType, decodeCredentialType, isCredentialExpired } from "../credentials";

describe("encodeCredentialType", () => {
  it("encodes UTF-8 string to uppercase hex", () => {
    expect(encodeCredentialType("KYC")).toBe("4B5943");
    expect(encodeCredentialType("AML Check")).toBe("414D4C20436865636B");
  });

  it("rejects empty or oversized input", () => {
    expect(() => encodeCredentialType("")).toThrow();
    expect(() => encodeCredentialType("a".repeat(129))).toThrow();
  });
});

describe("decodeCredentialType", () => {
  it("decodes hex back to UTF-8 string", () => {
    expect(decodeCredentialType("4B5943")).toBe("KYC");
  });

  it("falls back to raw hex for non-printable characters", () => {
    expect(decodeCredentialType("0001FF")).toBe("0001FF");
  });
});

describe("credential type round-trip", () => {
  it("round-trip encode then decode", () => {
    const values = ["KYC", "AML Check", "accredited_investor", "a".repeat(128)];
    for (const val of values) {
      expect(decodeCredentialType(encodeCredentialType(val))).toBe(val);
    }
  });
});

describe("isCredentialExpired", () => {
  it("returns true when expiresAtMs is in the past", () => {
    const cred = {
      issuer: "rTestIssuer",
      credentialType: "KYC",
      accepted: true,
      expiresAtMs: Date.now() - 1000,
    };
    expect(isCredentialExpired(cred)).toBe(true);
  });

  it("returns false when expiresAtMs is in the future", () => {
    const cred = {
      issuer: "rTestIssuer",
      credentialType: "KYC",
      accepted: true,
      expiresAtMs: Date.now() + 100000,
    };
    expect(isCredentialExpired(cred)).toBe(false);
  });

  it("returns false when expiresAtMs is undefined", () => {
    const cred = { issuer: "rTestIssuer", credentialType: "KYC", accepted: true };
    expect(isCredentialExpired(cred)).toBe(false);
  });
});
