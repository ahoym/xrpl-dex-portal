import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "xrpl";
import { fetchAndCacheTrades, tradesCacheKey } from "@/lib/xrpl/trades";

// ---------------------------------------------------------------------------
// Mock xrpl.getBalanceChanges — we control what balance deltas are returned
// ---------------------------------------------------------------------------
const mockGetBalanceChanges = vi.fn();
vi.mock("xrpl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xrpl")>();
  return {
    ...actual,
    getBalanceChanges: (...args: unknown[]) => mockGetBalanceChanges(...args),
  };
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ISSUER = "rISSUER1111111111111111111111111111";
const TRADER = "rTRADER2222222222222222222222222222";
const COUNTERPARTY = "rCOUNTER333333333333333333333333333";
const ISSUER_B = "rISSUERB444444444444444444444444444";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal account_tx transaction entry.
 *
 * The function under test iterates `response.result.transactions` and
 * inspects each entry's `tx_json`, `meta`, `hash`, and `close_time_iso`.
 */
function makeEntry(
  overrides: {
    txType?: string;
    account?: string;
    takerPays?: string | { currency: string; issuer: string; value: string };
    takerGets?: string | { currency: string; issuer: string; value: string };
    fee?: string;
    result?: string;
    hash?: string;
    time?: string;
    meta?: unknown;
    tx_json?: unknown;
  } = {},
) {
  return {
    tx_json:
      overrides.tx_json !== undefined
        ? overrides.tx_json
        : {
            TransactionType: overrides.txType ?? "OfferCreate",
            Account: overrides.account ?? TRADER,
            TakerPays: overrides.takerPays ?? "10000000", // 10 XRP in drops
            TakerGets: overrides.takerGets ?? {
              currency: "USD",
              issuer: ISSUER,
              value: "5",
            },
            Fee: overrides.fee ?? "12",
            hash: overrides.hash ?? "HASH_DEFAULT",
          },
    meta:
      overrides.meta !== undefined
        ? overrides.meta
        : {
            TransactionResult: overrides.result ?? "tesSUCCESS",
            AffectedNodes: [],
          },
    hash: overrides.hash ?? "HASH_DEFAULT",
    close_time_iso: overrides.time ?? "2025-01-15T12:00:00Z",
  };
}

/** Create a mock XRPL client that returns given transaction entries. */
function makeMockClient(transactions: unknown[]): Client {
  return {
    request: vi.fn().mockResolvedValue({
      result: { transactions },
    }),
  } as unknown as Client;
}

/**
 * Standard balance changes for an XRP/USD buy trade.
 *
 * In a real trade with `getBalanceChanges()`, the buyer gains base and
 * loses quote, the seller gains quote and loses base. The function only
 * counts positive values, so both sides contribute to the totals.
 *
 * The issuer account is skipped entirely.
 */
function xrpUsdBuyChanges(xrpAmount: string, usdAmount: string) {
  return [
    {
      account: TRADER,
      balances: [
        { currency: "XRP", value: xrpAmount },
        { currency: "USD", issuer: ISSUER, value: `-${usdAmount}` },
      ],
    },
    {
      account: COUNTERPARTY,
      balances: [
        { currency: "XRP", value: `-${xrpAmount}` },
        { currency: "USD", issuer: ISSUER, value: usdAmount },
      ],
    },
    {
      account: ISSUER,
      balances: [{ currency: "USD", issuer: ISSUER, value: "0" }],
    },
  ];
}

/**
 * Standard balance changes for an XRP/USD sell trade.
 * Trader loses XRP, gains USD. Counterparty gains XRP, loses USD.
 */
function xrpUsdSellChanges(xrpAmount: string, usdAmount: string) {
  return [
    {
      account: TRADER,
      balances: [
        { currency: "XRP", value: `-${xrpAmount}` },
        { currency: "USD", issuer: ISSUER, value: usdAmount },
      ],
    },
    {
      account: COUNTERPARTY,
      balances: [
        { currency: "XRP", value: xrpAmount },
        { currency: "USD", issuer: ISSUER, value: `-${usdAmount}` },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Reset mocks between tests; use unique network keys to avoid cache collision
// ---------------------------------------------------------------------------
let testIndex = 0;
function uniqueNetwork(): string {
  return `test-network-${testIndex++}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBalanceChanges.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchAndCacheTrades", () => {
  // -----------------------------------------------------------------------
  // 1. Amounts match raw getBalanceChanges output (no fee manipulation)
  // -----------------------------------------------------------------------
  describe("amounts match raw getBalanceChanges (no double fee deduction)", () => {
    it("returns baseAmount matching the raw balance change delta for an XRP/USD buy", async () => {
      const network = uniqueNetwork();
      // getBalanceChanges already returns deltas net of fees.
      // The old bug would subtract the fee again, making baseAmount = 10 - 0.000012.
      // After the fix, baseAmount should be exactly 10.
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("10", "5"));

      const entry = makeEntry({
        account: TRADER,
        takerPays: "10000000", // XRP drops — TakerPays matches base → buy
        takerGets: { currency: "USD", issuer: ISSUER, value: "5" },
        fee: "12",
        hash: "HASH_NO_DOUBLE_FEE",
      });

      const client = makeMockClient([entry]);
      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      // baseAmount should be exactly 10, NOT 10 - 0.000012
      expect(parseFloat(trades[0].baseAmount)).toBeCloseTo(10, 4);
      expect(trades[0].side).toBe("buy");
    });

    it("returns quoteAmount matching the raw balance change delta when XRP is the quote", async () => {
      const network = uniqueNetwork();
      // USD/XRP pair. Trader gains USD (base), counterparty gains XRP (quote).
      mockGetBalanceChanges.mockReturnValue([
        {
          account: TRADER,
          balances: [
            { currency: "USD", issuer: ISSUER, value: "20" },
            { currency: "XRP", value: "-40" },
          ],
        },
        {
          account: COUNTERPARTY,
          balances: [
            { currency: "USD", issuer: ISSUER, value: "-20" },
            { currency: "XRP", value: "40" },
          ],
        },
      ]);

      const entry = makeEntry({
        account: TRADER,
        takerPays: { currency: "USD", issuer: ISSUER, value: "20" },
        takerGets: "40000000",
        fee: "12",
        hash: "HASH_QUOTE_XRP",
      });

      const client = makeMockClient([entry]);
      const trades = await fetchAndCacheTrades(client, network, "USD", ISSUER, "XRP", undefined);

      expect(trades).toHaveLength(1);
      // quoteAmount = counterparty's +40 XRP, should be 40 exactly (no fee deduction)
      expect(parseFloat(trades[0].quoteAmount)).toBeCloseTo(40, 4);
      expect(parseFloat(trades[0].baseAmount)).toBeCloseTo(20, 4);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Side detection based on TakerPays currency
  // -----------------------------------------------------------------------
  describe("side detection (buy vs sell)", () => {
    it("marks side as 'buy' when TakerPays currency matches base currency (XRP)", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("10", "5"));

      const entry = makeEntry({
        takerPays: "10000000", // XRP — matches base
        takerGets: { currency: "USD", issuer: ISSUER, value: "5" },
        hash: "HASH_BUY",
      });

      const client = makeMockClient([entry]);
      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      expect(trades[0].side).toBe("buy");
    });

    it("marks side as 'sell' when TakerPays currency does NOT match base currency", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdSellChanges("10", "5"));

      const entry = makeEntry({
        takerPays: { currency: "USD", issuer: ISSUER, value: "5" }, // USD != base (XRP)
        takerGets: "10000000",
        hash: "HASH_SELL",
      });

      const client = makeMockClient([entry]);
      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      expect(trades[0].side).toBe("sell");
    });

    it("marks side as 'buy' for token base when TakerPays matches base token+issuer", async () => {
      const network = uniqueNetwork();
      // Token/Token: USD (base, ISSUER) / EUR (quote, ISSUER_B)
      mockGetBalanceChanges.mockReturnValue([
        {
          account: TRADER,
          balances: [
            { currency: "USD", issuer: ISSUER, value: "100" },
            { currency: "EUR", issuer: ISSUER_B, value: "-50" },
          ],
        },
        {
          account: COUNTERPARTY,
          balances: [
            { currency: "USD", issuer: ISSUER, value: "-100" },
            { currency: "EUR", issuer: ISSUER_B, value: "50" },
          ],
        },
      ]);

      const entry = makeEntry({
        takerPays: { currency: "USD", issuer: ISSUER, value: "100" }, // matches base
        takerGets: { currency: "EUR", issuer: ISSUER_B, value: "50" },
        hash: "HASH_TOKEN_BUY",
      });

      const client = makeMockClient([entry]);
      const trades = await fetchAndCacheTrades(client, network, "USD", ISSUER, "EUR", ISSUER_B);

      expect(trades).toHaveLength(1);
      expect(trades[0].side).toBe("buy");
    });
  });

  // -----------------------------------------------------------------------
  // 3. Cache merge, deduplication, sort, and cap logic
  // -----------------------------------------------------------------------
  describe("cache merge, deduplication, sort, and cap", () => {
    it("populates cache on first call", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("5", "2.5"));

      const entry = makeEntry({ hash: "HASH_FIRST", time: "2025-01-15T12:00:00Z" });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      expect(trades[0].hash).toBe("HASH_FIRST");
    });

    it("merges new trades with cached, deduplicates by hash, sorts desc, caps at 50", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("5", "2.5"));

      // First call: two trades
      const entry1 = makeEntry({ hash: "HASH_A", time: "2025-01-15T10:00:00Z" });
      const entry2 = makeEntry({ hash: "HASH_B", time: "2025-01-15T11:00:00Z" });
      const client1 = makeMockClient([entry1, entry2]);

      const trades1 = await fetchAndCacheTrades(client1, network, "XRP", undefined, "USD", ISSUER);
      expect(trades1).toHaveLength(2);

      // Second call: one new, one duplicate of HASH_A
      const entry3 = makeEntry({ hash: "HASH_C", time: "2025-01-15T12:00:00Z" });
      const entryDup = makeEntry({ hash: "HASH_A", time: "2025-01-15T10:00:00Z" });
      const client2 = makeMockClient([entry3, entryDup]);

      const trades2 = await fetchAndCacheTrades(client2, network, "XRP", undefined, "USD", ISSUER);

      // 3 unique trades after dedup
      expect(trades2).toHaveLength(3);
      // Sorted desc by time
      expect(trades2[0].hash).toBe("HASH_C"); // 12:00
      expect(trades2[1].hash).toBe("HASH_B"); // 11:00
      expect(trades2[2].hash).toBe("HASH_A"); // 10:00
    });

    it("caps merged result at 50 trades", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("1", "0.5"));

      // Create 60 unique entries — only 50 should be returned after the cap
      const entries = Array.from({ length: 60 }, (_, i) =>
        makeEntry({
          hash: `HASH_CAP_${String(i).padStart(3, "0")}`,
          time: `2025-01-15T${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`,
        }),
      );

      const client = makeMockClient(entries);
      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(50);
    });

    it("uses cache key matching tradesCacheKey output format", async () => {
      const network = uniqueNetwork();
      const expectedKey = tradesCacheKey(network, "XRP", undefined, "USD", ISSUER);
      expect(expectedKey).toBe(`${network}:XRP::USD:${ISSUER}`);

      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("5", "2.5"));

      const entry = makeEntry({ hash: "HASH_KEY_TEST" });
      const client = makeMockClient([entry]);

      // First call populates cache under that key
      await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      // Second call with different data merges into same cache key
      const entry2 = makeEntry({ hash: "HASH_KEY_TEST_2", time: "2025-01-16T00:00:00Z" });
      const client2 = makeMockClient([entry2]);
      const trades = await fetchAndCacheTrades(client2, network, "XRP", undefined, "USD", ISSUER);

      // Should have both the cached and new trade
      expect(trades).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Skipping non-OfferCreate transactions
  // -----------------------------------------------------------------------
  describe("skipping non-OfferCreate transactions", () => {
    it("skips Payment transactions", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue([]);

      const entry = makeEntry({ txType: "Payment", hash: "HASH_PAYMENT" });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(0);
    });

    it("skips TrustSet transactions", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue([]);

      const entry = makeEntry({ txType: "TrustSet", hash: "HASH_TRUSTSET" });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Skipping failed transactions
  // -----------------------------------------------------------------------
  describe("skipping failed transactions", () => {
    it("skips transactions with TransactionResult !== tesSUCCESS", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue([]);

      const entry = makeEntry({
        result: "tecUNFUNDED_OFFER",
        hash: "HASH_FAILED",
      });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(0);
      // getBalanceChanges should not have been called for a failed tx
      expect(mockGetBalanceChanges).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 6. Skipping missing metadata
  // -----------------------------------------------------------------------
  describe("skipping entries with missing or invalid metadata", () => {
    it("skips entries with no tx_json", async () => {
      const network = uniqueNetwork();
      const entry = {
        meta: { TransactionResult: "tesSUCCESS", AffectedNodes: [] },
        hash: "HASH_NO_TX",
        close_time_iso: "2025-01-15T12:00:00Z",
      };
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(0);
    });

    it("skips entries with no meta", async () => {
      const network = uniqueNetwork();
      const entry = {
        tx_json: {
          TransactionType: "OfferCreate",
          Account: TRADER,
          TakerPays: "10000000",
          TakerGets: { currency: "USD", issuer: ISSUER, value: "5" },
          Fee: "12",
          hash: "HASH_NO_META",
        },
        hash: "HASH_NO_META",
        close_time_iso: "2025-01-15T12:00:00Z",
      };
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(0);
    });

    it("skips entries where meta is a string (e.g., 'unavailable')", async () => {
      const network = uniqueNetwork();
      const entry = makeEntry({ meta: "unavailable" });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Skipping issuer account balance changes
  // -----------------------------------------------------------------------
  describe("skipping issuer account balance changes", () => {
    it("excludes balance changes from the issuer account", async () => {
      const network = uniqueNetwork();
      // The issuer has a large positive USD balance change that would inflate
      // quoteTotal if not skipped. Only TRADER and COUNTERPARTY changes count.
      mockGetBalanceChanges.mockReturnValue([
        {
          account: ISSUER, // issuer — must be skipped
          balances: [{ currency: "USD", issuer: ISSUER, value: "1000" }],
        },
        {
          account: TRADER,
          balances: [
            { currency: "XRP", value: "10" },
            { currency: "USD", issuer: ISSUER, value: "-5" },
          ],
        },
        {
          account: COUNTERPARTY,
          balances: [
            { currency: "XRP", value: "-10" },
            { currency: "USD", issuer: ISSUER, value: "5" },
          ],
        },
      ]);

      const entry = makeEntry({
        hash: "HASH_SKIP_ISSUER",
        takerPays: "10000000",
        takerGets: { currency: "USD", issuer: ISSUER, value: "5" },
      });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      // baseAmount should only reflect non-issuer positive XRP: TRADER's +10
      expect(parseFloat(trades[0].baseAmount)).toBeCloseTo(10, 4);
      // quoteAmount should only reflect non-issuer positive USD: COUNTERPARTY's +5
      // (not ISSUER's +1000)
      expect(parseFloat(trades[0].quoteAmount)).toBeCloseTo(5, 4);
    });

    it("produces no trade when all balance changes are from the issuer", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue([
        {
          account: ISSUER,
          balances: [
            { currency: "XRP", value: "10" },
            { currency: "USD", issuer: ISSUER, value: "5" },
          ],
        },
      ]);

      const entry = makeEntry({ hash: "HASH_ONLY_ISSUER" });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 8. Only positive balance changes counted
  // -----------------------------------------------------------------------
  describe("only positive balance changes counted", () => {
    it("skips negative and zero balance changes", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue([
        {
          account: TRADER,
          balances: [
            { currency: "XRP", value: "-10" }, // negative — skipped
            { currency: "USD", issuer: ISSUER, value: "0" }, // zero — skipped
          ],
        },
      ]);

      const entry = makeEntry({ hash: "HASH_NEG_ZERO" });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      // No positive changes for base or quote → both totals are 0 → skipped
      expect(trades).toHaveLength(0);
    });

    it("counts only the positive side of changes across multiple accounts", async () => {
      const network = uniqueNetwork();
      // TRADER gains 15 XRP (positive, counted as base), loses 7.5 USD (negative, skipped)
      // COUNTERPARTY loses 15 XRP (negative, skipped), gains 7.5 USD (positive, counted as quote)
      mockGetBalanceChanges.mockReturnValue([
        {
          account: TRADER,
          balances: [
            { currency: "XRP", value: "15" },
            { currency: "USD", issuer: ISSUER, value: "-7.5" },
          ],
        },
        {
          account: COUNTERPARTY,
          balances: [
            { currency: "XRP", value: "-15" },
            { currency: "USD", issuer: ISSUER, value: "7.5" },
          ],
        },
      ]);

      const entry = makeEntry({
        takerPays: "15000000",
        takerGets: { currency: "USD", issuer: ISSUER, value: "7.5" },
        hash: "HASH_POS_ONLY",
      });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      // TRADER's +15 XRP (base) + COUNTERPARTY's +7.5 USD (quote)
      expect(parseFloat(trades[0].baseAmount)).toBeCloseTo(15, 4);
      expect(parseFloat(trades[0].quoteAmount)).toBeCloseTo(7.5, 4);
    });
  });

  // -----------------------------------------------------------------------
  // 9. Token/Token pair (no XRP)
  // -----------------------------------------------------------------------
  describe("token/token pair (no XRP)", () => {
    it("correctly handles a token/token trade with no XRP involved", async () => {
      const network = uniqueNetwork();
      // Base = USD (ISSUER), Quote = EUR (ISSUER_B)
      // issuerAccount = baseIssuer = ISSUER (since base != XRP)
      // So ISSUER's changes are skipped.
      mockGetBalanceChanges.mockReturnValue([
        {
          account: ISSUER, // issuer — skipped
          balances: [{ currency: "USD", issuer: ISSUER, value: "-100" }],
        },
        {
          account: TRADER,
          balances: [
            { currency: "USD", issuer: ISSUER, value: "100" },
            { currency: "EUR", issuer: ISSUER_B, value: "-50" },
          ],
        },
        {
          account: COUNTERPARTY,
          balances: [
            { currency: "USD", issuer: ISSUER, value: "-100" },
            { currency: "EUR", issuer: ISSUER_B, value: "50" },
          ],
        },
      ]);

      const entry = makeEntry({
        takerPays: { currency: "USD", issuer: ISSUER, value: "100" }, // matches base → buy
        takerGets: { currency: "EUR", issuer: ISSUER_B, value: "50" },
        hash: "HASH_TOKEN_TOKEN",
      });

      const client = makeMockClient([entry]);
      const trades = await fetchAndCacheTrades(client, network, "USD", ISSUER, "EUR", ISSUER_B);

      expect(trades).toHaveLength(1);
      expect(trades[0].side).toBe("buy");
      // TRADER: +100 USD (base), COUNTERPARTY: +50 EUR (quote)
      expect(parseFloat(trades[0].baseAmount)).toBeCloseTo(100, 4);
      expect(parseFloat(trades[0].quoteAmount)).toBeCloseTo(50, 4);
      // price = quote / base = 50 / 100 = 0.5
      expect(parseFloat(trades[0].price)).toBeCloseTo(0.5, 4);
    });

    it("handles a token/token sell correctly", async () => {
      const network = uniqueNetwork();
      // Base = USD (ISSUER), Quote = EUR (ISSUER_B)
      // issuerAccount = ISSUER (base issuer, since base != XRP)
      mockGetBalanceChanges.mockReturnValue([
        {
          account: TRADER,
          balances: [
            { currency: "USD", issuer: ISSUER, value: "-30" },
            { currency: "EUR", issuer: ISSUER_B, value: "60" },
          ],
        },
        {
          account: COUNTERPARTY,
          balances: [
            { currency: "USD", issuer: ISSUER, value: "30" },
            { currency: "EUR", issuer: ISSUER_B, value: "-60" },
          ],
        },
      ]);

      const entry = makeEntry({
        takerPays: { currency: "EUR", issuer: ISSUER_B, value: "60" }, // EUR != base (USD) → sell
        takerGets: { currency: "USD", issuer: ISSUER, value: "30" },
        hash: "HASH_TOKEN_TOKEN_SELL",
      });

      const client = makeMockClient([entry]);
      const trades = await fetchAndCacheTrades(client, network, "USD", ISSUER, "EUR", ISSUER_B);

      expect(trades).toHaveLength(1);
      expect(trades[0].side).toBe("sell");
      // COUNTERPARTY: +30 USD (base), TRADER: +60 EUR (quote)
      expect(parseFloat(trades[0].baseAmount)).toBeCloseTo(30, 4);
      expect(parseFloat(trades[0].quoteAmount)).toBeCloseTo(60, 4);
    });
  });

  // -----------------------------------------------------------------------
  // Price computation
  // -----------------------------------------------------------------------
  describe("price computation", () => {
    it("computes price as quoteTotal / baseTotal with toPrecision(6)", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("25", "5"));

      const entry = makeEntry({
        takerPays: "25000000",
        takerGets: { currency: "USD", issuer: ISSUER, value: "5" },
        hash: "HASH_PRICE",
      });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      // price = 5 / 25 = 0.2
      expect(trades[0].price).toBe("0.200000");
      expect(trades[0].baseAmount).toBe("25.0000");
      expect(trades[0].quoteAmount).toBe("5.00000");
    });
  });

  // -----------------------------------------------------------------------
  // Time and hash extraction
  // -----------------------------------------------------------------------
  describe("time and hash extraction", () => {
    it("uses close_time_iso for time", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("1", "0.5"));

      const entry = makeEntry({
        hash: "HASH_TIME",
        time: "2025-06-01T14:30:00Z",
      });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      expect(trades[0].time).toBe("2025-06-01T14:30:00Z");
      expect(trades[0].hash).toBe("HASH_TIME");
    });

    it("extracts hash from entry.hash, falling back to tx_json.hash", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("1", "0.5"));

      // Entry where top-level hash differs from tx_json.hash
      const entry = {
        tx_json: {
          TransactionType: "OfferCreate",
          Account: TRADER,
          TakerPays: "1000000",
          TakerGets: { currency: "USD", issuer: ISSUER, value: "0.5" },
          Fee: "12",
          hash: "TX_JSON_HASH",
        },
        meta: {
          TransactionResult: "tesSUCCESS",
          AffectedNodes: [],
        },
        hash: "ENTRY_HASH",
        close_time_iso: "2025-01-15T12:00:00Z",
      };
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      expect(trades[0].hash).toBe("ENTRY_HASH"); // entry.hash takes priority
    });
  });

  // -----------------------------------------------------------------------
  // Account field
  // -----------------------------------------------------------------------
  describe("account field", () => {
    it("sets trade.account to tx.Account", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue(xrpUsdBuyChanges("10", "5"));

      const entry = makeEntry({
        account: TRADER,
        hash: "HASH_ACCOUNT",
      });
      const client = makeMockClient([entry]);

      const trades = await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(trades).toHaveLength(1);
      expect(trades[0].account).toBe(TRADER);
    });
  });

  // -----------------------------------------------------------------------
  // client.request call parameters
  // -----------------------------------------------------------------------
  describe("client.request call", () => {
    it("calls account_tx with the issuer account and correct limit", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue([]);

      const client = makeMockClient([]);
      await fetchAndCacheTrades(client, network, "XRP", undefined, "USD", ISSUER);

      expect(client.request).toHaveBeenCalledWith({
        command: "account_tx",
        account: ISSUER, // quoteIssuer since base is XRP
        limit: 250, // TRADES_CACHE_LIMIT (50) * TRADES_FETCH_MULTIPLIER (5)
      });
    });

    it("uses baseIssuer as issuerAccount when base is not XRP", async () => {
      const network = uniqueNetwork();
      mockGetBalanceChanges.mockReturnValue([]);

      const client = makeMockClient([]);
      await fetchAndCacheTrades(client, network, "USD", ISSUER, "XRP", undefined);

      expect(client.request).toHaveBeenCalledWith({
        command: "account_tx",
        account: ISSUER, // baseIssuer since base is not XRP
        limit: 250,
      });
    });
  });
});
