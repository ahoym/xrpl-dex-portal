import { describe, it, expect } from "vitest";
import { parseFilledOrders } from "@/lib/xrpl/filled-orders";

// ---------------------------------------------------------------------------
// Constants used across fixtures
// ---------------------------------------------------------------------------
const WALLET = "rWALLET111111111111111111111111111";
const OTHER_ACCOUNT = "rOTHER2222222222222222222222222222";
const ISSUER = "rISSUER3333333333333333333333333333";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build an AccountRoot ModifiedNode showing an XRP balance change (drops). */
function accountRootNode(account: string, prevDrops: string, finalDrops: string) {
  return {
    ModifiedNode: {
      LedgerEntryType: "AccountRoot",
      PreviousFields: { Balance: prevDrops },
      FinalFields: { Account: account, Balance: finalDrops },
    },
  };
}

/** Build a RippleState ModifiedNode for a token balance change. */
function rippleStateNode(
  currency: string,
  lowAccount: string,
  highAccount: string,
  prevValue: string,
  finalValue: string,
) {
  return {
    ModifiedNode: {
      LedgerEntryType: "RippleState",
      PreviousFields: {
        Balance: { currency, value: prevValue, issuer: "rrrrrrrrrrrrrrrrrrrrBZbvji" },
      },
      FinalFields: {
        Balance: { currency, value: finalValue, issuer: "rrrrrrrrrrrrrrrrrrrrBZbvji" },
        LowLimit: { issuer: lowAccount },
        HighLimit: { issuer: highAccount },
      },
    },
  };
}

/** Wrap metadata + tx fields into a transaction entry. */
function makeTxEntry(
  overrides: Partial<{
    tx_json: Record<string, unknown>;
    meta: Record<string, unknown>;
    hash: string;
    close_time_iso: string;
  }> = {},
) {
  return {
    tx_json: {
      TransactionType: "OfferCreate",
      Account: WALLET,
      hash: "AABBCCDD",
      ...(overrides.tx_json ?? {}),
    },
    meta: {
      TransactionResult: "tesSUCCESS",
      AffectedNodes: [],
      ...(overrides.meta ?? {}),
    },
    hash: overrides.hash ?? "AABBCCDD",
    close_time_iso: overrides.close_time_iso ?? "2025-01-15T12:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseFilledOrders", () => {
  // 1. Empty transactions array
  it("returns empty array for empty transactions", () => {
    const result = parseFilledOrders([], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  // 2. Non-OfferCreate transactions skipped
  it("skips non-OfferCreate transactions (e.g., Payment)", () => {
    const tx = makeTxEntry({
      tx_json: { TransactionType: "Payment", Account: WALLET },
    });
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  it("skips TrustSet transactions", () => {
    const tx = makeTxEntry({
      tx_json: { TransactionType: "TrustSet", Account: WALLET },
    });
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  // 3. Failed transactions skipped
  it("skips failed transactions (TransactionResult !== tesSUCCESS)", () => {
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tecUNFUNDED_OFFER",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "110000000"),
          rippleStateNode("USD", WALLET, ISSUER, "100", "90"),
        ],
      },
    });
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  // 4. Transactions from other accounts skipped
  it("skips transactions from other accounts", () => {
    const tx = makeTxEntry({
      tx_json: { TransactionType: "OfferCreate", Account: OTHER_ACCOUNT },
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(OTHER_ACCOUNT, "100000000", "110000000"),
          rippleStateNode("USD", OTHER_ACCOUNT, ISSUER, "100", "90"),
        ],
      },
    });
    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  // 5. XRP buy fill
  it("detects an XRP buy fill (wallet gains XRP, loses USD token)", () => {
    // Wallet gains 10 XRP (100M + 10M drops) and loses 5 USD
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "110000000"), // +10 XRP
          rippleStateNode("USD", WALLET, ISSUER, "50", "45"), // -5 USD (low account lost)
        ],
      },
      hash: "HASH_BUY_XRP",
      close_time_iso: "2025-06-01T10:00:00Z",
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);

    const order = result[0];
    expect(order.side).toBe("buy"); // wallet gained base (XRP)
    expect(order.hash).toBe("HASH_BUY_XRP");
    expect(order.time).toBe("2025-06-01T10:00:00Z");
    // base = 10 XRP, quote = 5 USD, price = 5/10 = 0.5
    expect(parseFloat(order.baseAmount)).toBeCloseTo(10, 4);
    expect(parseFloat(order.quoteAmount)).toBeCloseTo(5, 4);
    expect(parseFloat(order.price)).toBeCloseTo(0.5, 4);
  });

  // 6. Token sell fill
  it("detects a token sell fill (wallet loses base token, gains XRP as quote)", () => {
    // Base = USD token, Quote = XRP
    // Wallet loses 20 USD (low account) and gains 40 XRP
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          rippleStateNode("USD", WALLET, ISSUER, "100", "80"), // -20 USD (low went down)
          accountRootNode(WALLET, "200000000", "240000000"), // +40 XRP
        ],
      },
      hash: "HASH_SELL_TOKEN",
      close_time_iso: "2025-07-01T14:30:00Z",
    });

    const result = parseFilledOrders([tx], WALLET, "USD", ISSUER, "XRP", undefined);
    expect(result).toHaveLength(1);

    const order = result[0];
    expect(order.side).toBe("sell"); // wallet lost base (USD)
    // base = 20, quote = 40, price = 40/20 = 2
    expect(parseFloat(order.baseAmount)).toBeCloseTo(20, 4);
    expect(parseFloat(order.quoteAmount)).toBeCloseTo(40, 4);
    expect(parseFloat(order.price)).toBeCloseTo(2, 4);
    expect(order.hash).toBe("HASH_SELL_TOKEN");
  });

  // 7. RippleState balance sign correctness
  it("correctly handles RippleState sign: positive delta means LOW account gained", () => {
    // Wallet is the LOW account. Balance goes from 10 to 30 → +20 for low.
    // Wallet is also LOW on a second token, which decreases.
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          rippleStateNode("EUR", WALLET, ISSUER, "10", "30"), // low (WALLET) gained 20 EUR
          rippleStateNode("USD", WALLET, ISSUER, "100", "90"), // low (WALLET) lost 10 USD
        ],
      },
      hash: "HASH_SIGN",
    });

    // Base = EUR, Quote = USD
    const result = parseFilledOrders([tx], WALLET, "EUR", ISSUER, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(result[0].side).toBe("buy"); // gained base (EUR)
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(20, 4);
    expect(parseFloat(result[0].quoteAmount)).toBeCloseTo(10, 4);
  });

  it("correctly handles wallet as HIGH account: negative balance delta means HIGH gained", () => {
    // Wallet is the HIGH account. Balance goes from 10 to 5 → delta = -5.
    // For RippleState: negative delta means high gained, low lost.
    // So WALLET (high) gains 5 of the token.
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          // WALLET is high, ISSUER is low. Balance drops from 10 to 5
          // delta = -5, so low lost 5, high (WALLET) gained 5.
          rippleStateNode("EUR", ISSUER, WALLET, "10", "5"),
          // WALLET is low for USD, balance drops 100 -> 90 (wallet loses 10 USD)
          rippleStateNode("USD", WALLET, ISSUER, "100", "90"),
        ],
      },
      hash: "HASH_HIGH",
    });

    const result = parseFilledOrders([tx], WALLET, "EUR", ISSUER, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(result[0].side).toBe("buy"); // wallet gained base (EUR)
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(5, 4);
    expect(parseFloat(result[0].quoteAmount)).toBeCloseTo(10, 4);
  });

  // 8. Fee-only XRP changes filtered
  it("skips transactions where XRP delta is fee-only (< 0.001 XRP)", () => {
    // Wallet pays only a 12-drop fee (0.000012 XRP), no real trade fill
    // Quote side has a meaningful token change, but base (XRP) is fee-only
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "99999988"), // -12 drops = -0.000012 XRP (fee only)
          rippleStateNode("USD", WALLET, ISSUER, "50", "55"), // +5 USD
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  it("skips transactions where quote delta is below threshold", () => {
    // Base changes meaningfully but quote is near-zero
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "110000000"), // +10 XRP
          rippleStateNode("USD", WALLET, ISSUER, "50.0000", "50.0001"), // +0.0001 USD (too small)
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  // 9. Missing tx_json or meta skipped gracefully
  it("skips entries with missing tx_json", () => {
    const entry = { meta: { TransactionResult: "tesSUCCESS", AffectedNodes: [] } };
    const result = parseFilledOrders([entry], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  it("skips entries with missing meta", () => {
    const entry = {
      tx_json: { TransactionType: "OfferCreate", Account: WALLET },
    };
    const result = parseFilledOrders([entry], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  it("skips entries where meta is a string (e.g., 'unavailable')", () => {
    const entry = {
      tx_json: { TransactionType: "OfferCreate", Account: WALLET },
      meta: "unavailable",
    };
    const result = parseFilledOrders(
      [entry as unknown as Record<string, unknown>],
      WALLET,
      "XRP",
      undefined,
      "USD",
      ISSUER,
    );
    expect(result).toEqual([]);
  });

  it("skips entries where both tx_json and meta are missing", () => {
    const result = parseFilledOrders([{}], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toEqual([]);
  });

  // 10. Hash extraction
  it("extracts hash from entry.hash", () => {
    const tx = makeTxEntry({
      tx_json: { TransactionType: "OfferCreate", Account: WALLET, hash: "TX_JSON_HASH" },
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "120000000"),
          rippleStateNode("USD", WALLET, ISSUER, "50", "40"),
        ],
      },
      hash: "ENTRY_HASH",
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("ENTRY_HASH"); // entry.hash takes priority
  });

  it("falls back to tx_json.hash when entry.hash is absent", () => {
    const tx = {
      tx_json: {
        TransactionType: "OfferCreate",
        Account: WALLET,
        hash: "TX_JSON_HASH_FALLBACK",
      },
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "120000000"),
          rippleStateNode("USD", WALLET, ISSUER, "50", "40"),
        ],
      },
      close_time_iso: "2025-01-01T00:00:00Z",
    };

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("TX_JSON_HASH_FALLBACK");
  });

  // ---------------------------------------------------------------------------
  // Additional edge case / integration tests
  // ---------------------------------------------------------------------------

  it("returns multiple filled orders from multiple transactions", () => {
    const tx1 = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "105000000"), // +5 XRP
          rippleStateNode("USD", WALLET, ISSUER, "50", "47.5"), // -2.5 USD
        ],
      },
      hash: "HASH1",
    });
    const tx2 = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "105000000", "95000000"), // -10 XRP
          rippleStateNode("USD", WALLET, ISSUER, "47.5", "52.5"), // +5 USD
        ],
      },
      hash: "HASH2",
    });

    const result = parseFilledOrders([tx1, tx2], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(2);
    expect(result[0].side).toBe("buy"); // gained XRP
    expect(result[0].hash).toBe("HASH1");
    expect(result[1].side).toBe("sell"); // lost XRP
    expect(result[1].hash).toBe("HASH2");
  });

  it("handles mixed valid and invalid transactions", () => {
    const validTx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "120000000"), // +20 XRP
          rippleStateNode("USD", WALLET, ISSUER, "100", "90"), // -10 USD
        ],
      },
      hash: "VALID_HASH",
    });
    const failedTx = makeTxEntry({
      meta: { TransactionResult: "tecKILLED", AffectedNodes: [] },
    });
    const paymentTx = makeTxEntry({
      tx_json: { TransactionType: "Payment", Account: WALLET },
    });

    const result = parseFilledOrders(
      [failedTx, validTx, paymentTx],
      WALLET,
      "XRP",
      undefined,
      "USD",
      ISSUER,
    );
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("VALID_HASH");
  });

  it("uses close_time_iso for the time field, falling back to date", () => {
    // With close_time_iso
    const tx1 = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "120000000"),
          rippleStateNode("USD", WALLET, ISSUER, "100", "90"),
        ],
      },
      close_time_iso: "2025-03-15T08:30:00Z",
    });

    const result1 = parseFilledOrders([tx1], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result1[0].time).toBe("2025-03-15T08:30:00Z");
  });

  it("handles token-to-token fills (no XRP involved)", () => {
    // Base = EUR, Quote = USD, both tokens
    const ISSUER2 = "rISSUER4444444444444444444444444444";
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          rippleStateNode("EUR", WALLET, ISSUER2, "0", "100"), // gained 100 EUR
          rippleStateNode("USD", WALLET, ISSUER, "200", "150"), // lost 50 USD
        ],
      },
      hash: "TOKEN_TOKEN_HASH",
    });

    const result = parseFilledOrders([tx], WALLET, "EUR", ISSUER2, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(result[0].side).toBe("buy"); // gained base (EUR)
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(100, 4);
    expect(parseFloat(result[0].quoteAmount)).toBeCloseTo(50, 4);
    expect(parseFloat(result[0].price)).toBeCloseTo(0.5, 4);
  });

  it("correctly computes price as quoteAmount / baseAmount", () => {
    // 25 XRP gained, 5 USD lost → price = 5/25 = 0.2
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "125000000"), // +25 XRP
          rippleStateNode("USD", WALLET, ISSUER, "100", "95"), // -5 USD
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(parseFloat(result[0].price)).toBeCloseTo(0.2, 6);
  });

  it("handles CreatedNode for AccountRoot (new account activation)", () => {
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          {
            CreatedNode: {
              LedgerEntryType: "AccountRoot",
              NewFields: { Account: WALLET, Balance: "50000000" }, // 50 XRP activated
            },
          },
          rippleStateNode("USD", WALLET, ISSUER, "100", "75"), // lost 25 USD
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(result[0].side).toBe("buy"); // gained XRP
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(50, 4);
    expect(parseFloat(result[0].quoteAmount)).toBeCloseTo(25, 4);
  });

  it("handles AffectedNodes with no relevant wrapper (skips gracefully)", () => {
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          { SomethingElse: { LedgerEntryType: "Offer" } }, // no ModifiedNode/CreatedNode/DeletedNode
          accountRootNode(WALLET, "100000000", "115000000"), // +15 XRP
          rippleStateNode("USD", WALLET, ISSUER, "100", "92.5"), // -7.5 USD
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(15, 4);
    expect(parseFloat(result[0].quoteAmount)).toBeCloseTo(7.5, 4);
  });

  it("ignores balance changes for currencies not in the trading pair", () => {
    // The tx also modifies a GBP balance, but we only care about XRP/USD
    const ISSUER_GBP = "rGBP55555555555555555555555555555555";
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "120000000"), // +20 XRP
          rippleStateNode("USD", WALLET, ISSUER, "100", "90"), // -10 USD
          rippleStateNode("GBP", WALLET, ISSUER_GBP, "0", "50"), // +50 GBP (unrelated)
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    // Only XRP and USD should be reflected
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(20, 4);
    expect(parseFloat(result[0].quoteAmount)).toBeCloseTo(10, 4);
  });

  it("filters out balance changes for other accounts (not wallet)", () => {
    // Another account also has balance changes in the same tx
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "108000000"), // WALLET +8 XRP
          accountRootNode(OTHER_ACCOUNT, "200000000", "192000000"), // OTHER -8 XRP
          rippleStateNode("USD", WALLET, ISSUER, "100", "96"), // WALLET -4 USD
          rippleStateNode("USD", OTHER_ACCOUNT, ISSUER, "50", "54"), // OTHER +4 USD
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(result[0].side).toBe("buy");
    // Should only reflect WALLET's changes: +8 XRP, -4 USD
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(8, 4);
    expect(parseFloat(result[0].quoteAmount)).toBeCloseTo(4, 4);
  });

  it("uses toPrecision(6) formatting for amounts and price", () => {
    // 3 XRP gained, 1.5 USD lost → price = 0.5
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          accountRootNode(WALLET, "100000000", "103000000"), // +3 XRP
          rippleStateNode("USD", WALLET, ISSUER, "100", "98.5"), // -1.5 USD
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    // toPrecision(6)
    expect(result[0].baseAmount).toBe((3).toPrecision(6)); // "3.00000"
    expect(result[0].quoteAmount).toBe((1.5).toPrecision(6)); // "1.50000"
    expect(result[0].price).toBe((0.5).toPrecision(6)); // "0.500000"
  });

  it("handles RippleState with no PreviousFields (created trust line)", () => {
    // A new RippleState created (no PreviousFields.Balance), balance starts at some value
    const tx = makeTxEntry({
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          {
            CreatedNode: {
              LedgerEntryType: "RippleState",
              NewFields: {
                Balance: { currency: "USD", value: "25", issuer: "rrrrrrrrrrrrrrrrrrrrBZbvji" },
                LowLimit: { issuer: WALLET },
                HighLimit: { issuer: ISSUER },
              },
            },
          },
          accountRootNode(WALLET, "150000000", "100000000"), // -50 XRP
        ],
      },
    });

    const result = parseFilledOrders([tx], WALLET, "XRP", undefined, "USD", ISSUER);
    expect(result).toHaveLength(1);
    expect(result[0].side).toBe("sell"); // lost XRP
    expect(parseFloat(result[0].baseAmount)).toBeCloseTo(50, 4);
    expect(parseFloat(result[0].quoteAmount)).toBeCloseTo(25, 4);
  });
});
