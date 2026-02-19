import { describe, it, expect, vi } from "vitest";
import {
  parseIntQueryParam,
  validateRequired,
  validateAddress,
  validatePositiveAmount,
  validateCredentialType,
  validateDexAmount,
  getTransactionResult,
  isAccountNotFound,
  walletFromSeed,
} from "@/lib/api";
import type { DexAmount } from "@/lib/xrpl/types";

// ---------------------------------------------------------------------------
// parseIntQueryParam
// ---------------------------------------------------------------------------

describe("parseIntQueryParam", () => {
  it("returns parsed integer for a valid value", () => {
    const sp = new URLSearchParams({ limit: "10" });
    expect(parseIntQueryParam(sp, "limit", 25, 100)).toBe(10);
  });

  it("returns defaultValue when key is missing", () => {
    const sp = new URLSearchParams();
    expect(parseIntQueryParam(sp, "limit", 25, 100)).toBe(25);
  });

  it("returns defaultValue for a non-numeric string", () => {
    const sp = new URLSearchParams({ limit: "abc" });
    expect(parseIntQueryParam(sp, "limit", 25, 100)).toBe(25);
  });

  it("clamps to maxValue when parsed value exceeds it", () => {
    const sp = new URLSearchParams({ limit: "200" });
    expect(parseIntQueryParam(sp, "limit", 25, 100)).toBe(100);
  });

  it("returns the value when it equals maxValue", () => {
    const sp = new URLSearchParams({ limit: "100" });
    expect(parseIntQueryParam(sp, "limit", 25, 100)).toBe(100);
  });

  it("clamps defaultValue to maxValue when default exceeds max", () => {
    const sp = new URLSearchParams();
    expect(parseIntQueryParam(sp, "limit", 150, 100)).toBe(100);
  });

  it("handles zero as a valid parsed value", () => {
    const sp = new URLSearchParams({ offset: "0" });
    expect(parseIntQueryParam(sp, "offset", 5, 100)).toBe(0);
  });

  it("handles negative values (returns negative since no lower clamp)", () => {
    const sp = new URLSearchParams({ offset: "-5" });
    expect(parseIntQueryParam(sp, "offset", 0, 100)).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// validateRequired
// ---------------------------------------------------------------------------

describe("validateRequired", () => {
  it("returns null when all fields are present", () => {
    const data = { name: "Alice", seed: "sXXX" };
    expect(validateRequired(data, ["name", "seed"])).toBeNull();
  });

  it("returns 400 Response when one field is missing", async () => {
    const data = { name: "Alice" };
    const resp = validateRequired(data, ["name", "seed"]);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("seed");
  });

  it("returns 400 Response listing multiple missing fields", async () => {
    const data = {};
    const resp = validateRequired(data, ["name", "seed", "network"]);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("name");
    expect(body.error).toContain("seed");
    expect(body.error).toContain("network");
  });

  it("treats empty string as missing (falsy)", async () => {
    const data = { name: "", seed: "sXXX" };
    const resp = validateRequired(data, ["name", "seed"]);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("name");
  });

  it("treats zero as missing (falsy)", async () => {
    const data = { count: 0 };
    const resp = validateRequired(data, ["count"]);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
  });

  it("returns null for an empty fields array", () => {
    expect(validateRequired({}, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateAddress
// ---------------------------------------------------------------------------

describe("validateAddress", () => {
  it("returns null for a valid XRPL classic address", () => {
    // Well-known genesis address
    const resp = validateAddress("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh", "account");
    expect(resp).toBeNull();
  });

  it("returns 400 for an empty string", async () => {
    const resp = validateAddress("", "account");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("Invalid");
    expect(body.error).toContain("account");
  });

  it("returns 400 for random garbage", async () => {
    const resp = validateAddress("not-an-address", "destination");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("Invalid");
    expect(body.error).toContain("destination");
  });

  it("returns 400 for an address that is too short", async () => {
    const resp = validateAddress("rShort", "sender");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
  });

  it("uses fieldName in the error message", async () => {
    const resp = validateAddress("xyz", "recipientAddress");
    expect(resp).not.toBeNull();
    const body = await resp!.json();
    expect(body.error).toBe("Invalid recipientAddress");
  });
});

// ---------------------------------------------------------------------------
// validatePositiveAmount
// ---------------------------------------------------------------------------

describe("validatePositiveAmount", () => {
  it("returns null for a positive integer string", () => {
    expect(validatePositiveAmount("100", "amount")).toBeNull();
  });

  it("returns null for a positive decimal string", () => {
    expect(validatePositiveAmount("0.5", "amount")).toBeNull();
  });

  it("returns 400 for zero", async () => {
    const resp = validatePositiveAmount("0", "amount");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("positive number");
  });

  it("returns 400 for a negative number", async () => {
    const resp = validatePositiveAmount("-1", "amount");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
  });

  it("returns 400 for a non-numeric string", async () => {
    const resp = validatePositiveAmount("abc", "amount");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("positive number");
  });

  it("returns 400 for an empty string", async () => {
    const resp = validatePositiveAmount("", "amount");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
  });

  it("returns 400 for Infinity", async () => {
    const resp = validatePositiveAmount("Infinity", "amount");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
  });

  it("includes fieldName in the error message", async () => {
    const resp = validatePositiveAmount("abc", "takerGets.value");
    expect(resp).not.toBeNull();
    const body = await resp!.json();
    expect(body.error).toContain("takerGets.value");
  });
});

// ---------------------------------------------------------------------------
// validateCredentialType
// ---------------------------------------------------------------------------

describe("validateCredentialType", () => {
  it("returns null for a valid credential type", () => {
    expect(validateCredentialType("KYC")).toBeNull();
  });

  it("returns null for a max-length credential type", () => {
    expect(validateCredentialType("a".repeat(128))).toBeNull();
  });

  it("returns 400 for an empty string", async () => {
    const resp = validateCredentialType("");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("credentialType is required");
  });

  it("returns 400 for a too-long string", async () => {
    const resp = validateCredentialType("a".repeat(129));
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("exceeds maximum length");
  });
});

// ---------------------------------------------------------------------------
// validateDexAmount
// ---------------------------------------------------------------------------

describe("validateDexAmount", () => {
  it("returns null for a valid XRP amount (no issuer needed)", () => {
    const amount: DexAmount = { currency: "XRP", value: "100" };
    expect(validateDexAmount(amount, "takerGets")).toBeNull();
  });

  it("returns null for a valid issued currency amount", () => {
    const amount: DexAmount = {
      currency: "RLUSD",
      issuer: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
      value: "50",
    };
    expect(validateDexAmount(amount, "takerPays")).toBeNull();
  });

  it("returns 400 when currency is missing", async () => {
    const amount = { currency: "", value: "100" } as DexAmount;
    const resp = validateDexAmount(amount, "takerGets");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("currency and value");
  });

  it("returns 400 when value is missing", async () => {
    const amount = { currency: "XRP", value: "" } as DexAmount;
    const resp = validateDexAmount(amount, "takerGets");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("currency and value");
  });

  it("returns 400 for non-XRP currency without issuer", async () => {
    const amount: DexAmount = { currency: "RLUSD", value: "50" };
    const resp = validateDexAmount(amount, "takerPays");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("issuer is required");
  });

  it("returns 400 for non-XRP currency with invalid issuer address", async () => {
    const amount: DexAmount = {
      currency: "RLUSD",
      issuer: "invalid-address",
      value: "50",
    };
    const resp = validateDexAmount(amount, "takerPays");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("Invalid");
    expect(body.error).toContain("issuer");
  });

  it("returns 400 for zero value", async () => {
    const amount: DexAmount = { currency: "XRP", value: "0" };
    const resp = validateDexAmount(amount, "takerGets");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
    const body = await resp!.json();
    expect(body.error).toContain("positive number");
  });

  it("returns 400 for negative value on issued currency", async () => {
    const amount: DexAmount = {
      currency: "RLUSD",
      issuer: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
      value: "-10",
    };
    const resp = validateDexAmount(amount, "takerPays");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
  });

  it("returns 400 for non-numeric value", async () => {
    const amount: DexAmount = { currency: "XRP", value: "abc" };
    const resp = validateDexAmount(amount, "takerGets");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// getTransactionResult
// ---------------------------------------------------------------------------

describe("getTransactionResult", () => {
  it("extracts TransactionResult string for tesSUCCESS", () => {
    expect(getTransactionResult({ TransactionResult: "tesSUCCESS" })).toBe("tesSUCCESS");
  });

  it("extracts TransactionResult string for tecPATH_DRY", () => {
    expect(getTransactionResult({ TransactionResult: "tecPATH_DRY" })).toBe("tecPATH_DRY");
  });

  it("returns undefined for null", () => {
    expect(getTransactionResult(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(getTransactionResult(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty object", () => {
    expect(getTransactionResult({})).toBeUndefined();
  });

  it("returns undefined for a non-object value (number)", () => {
    expect(getTransactionResult(42)).toBeUndefined();
  });

  it("returns undefined for a non-object value (string)", () => {
    expect(getTransactionResult("tesSUCCESS")).toBeUndefined();
  });

  it("returns undefined when TransactionResult is not a string", () => {
    expect(getTransactionResult({ TransactionResult: 123 })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isAccountNotFound
// ---------------------------------------------------------------------------

describe("isAccountNotFound", () => {
  it('returns true for Error with "actNotFound" in message', () => {
    expect(isAccountNotFound(new Error("actNotFound"))).toBe(true);
  });

  it('returns true for Error with "Account not found." in message', () => {
    expect(isAccountNotFound(new Error("Account not found."))).toBe(true);
  });

  it('returns true for Error with data.error = "actNotFound"', () => {
    const err = new Error("some other message") as Error & {
      data?: { error?: string };
    };
    err.data = { error: "actNotFound" };
    expect(isAccountNotFound(err)).toBe(true);
  });

  it("returns false for unrelated Error", () => {
    expect(isAccountNotFound(new Error("connection timeout"))).toBe(false);
  });

  it("returns false for a non-Error value (string)", () => {
    expect(isAccountNotFound("actNotFound")).toBe(false);
  });

  it("returns false for a non-Error value (null)", () => {
    expect(isAccountNotFound(null)).toBe(false);
  });

  it("returns false for a non-Error value (plain object)", () => {
    expect(isAccountNotFound({ message: "actNotFound" })).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAccountNotFound(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// walletFromSeed
// ---------------------------------------------------------------------------

describe("walletFromSeed", () => {
  it("returns { error } Response with 400 for an invalid seed", async () => {
    const result = walletFromSeed("not-a-valid-seed");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      const body = await result.error.json();
      expect(body.error).toContain("Invalid seed");
    }
  });

  it("returns { wallet } for a valid seed", async () => {
    // Mock Wallet.fromSeed since @noble/curves crypto doesn't work in jsdom
    const { Wallet } = await import("xrpl");
    const mockWallet = { address: "rTestAddress123456789012345", seed: "sValidSeed" };
    const spy = vi.spyOn(Wallet, "fromSeed").mockReturnValue(mockWallet as never);

    const result = walletFromSeed("sValidSeed");
    expect("wallet" in result).toBe(true);
    if ("wallet" in result) {
      expect(result.wallet.address).toBe("rTestAddress123456789012345");
      expect(result.wallet.seed).toBe("sValidSeed");
    }

    spy.mockRestore();
  });

  it("returns { error } for an empty string", async () => {
    const result = walletFromSeed("");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
    }
  });
});
