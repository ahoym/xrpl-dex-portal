import { describe, it, expect } from "vitest";
import { buildCurrencyOptions, detectNewOwnTrades } from "@/lib/hooks/use-trading-data-utils";
import type { BalanceEntry } from "@/lib/types";
import { WELL_KNOWN_CURRENCIES } from "@/lib/assets";

// ---------------------------------------------------------------------------
// Known bugs in the original hook (documented here for task 2A)
// ---------------------------------------------------------------------------

// BUG: Timer leak in expiration tracking (use-trading-data.ts, lines 244-267).
// When `accountOffers` changes, the useEffect cleanup runs and clears old
// timers. However, if `address` or `network` changes between renders while
// timers are pending, the old timers reference stale `address`/`network`
// values in their closures. The cleanup function only clears timers from the
// *current* effect invocation, not from previous renders that may have
// already been cleaned up, so this is mostly correct. The real risk is that
// the `fetchAccountOffers` callback captures stale closure values if it were
// not stable (it is stable via useCallback with []), but the `address` and
// `network` captured in the setTimeout closure could be stale if they change
// between scheduling and firing.

// BUG: Race condition in polling (use-trading-data.ts, line 210).
// `pollingMarketData.current` acts as a mutex to prevent overlapping
// requests, but if a request is in-flight when the effect re-runs (e.g.,
// because `sellingCurrency` changes), the interval is cleared and recreated
// while `pollingMarketData.current` is still `true`. This means the new
// interval's first tick will skip fetching because the flag is still set.
// The flag is only reset in the `.finally()` of the old request, which may
// complete after the new interval has already fired once. This could cause
// a one-tick delay in polling, or in pathological cases, permanently block
// polling if the old request never completes (e.g., network timeout without
// a hard limit).

// ---------------------------------------------------------------------------
// Constants used across fixtures
// ---------------------------------------------------------------------------
const WALLET = "rWALLET111111111111111111111111111";
const RLUSD_ISSUER_MAINNET = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const RLUSD_ISSUER_TESTNET = "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV";
const BBRL_ISSUER_MAINNET = "rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt";
const CUSTOM_ISSUER = "rCUSTOM444444444444444444444444444";

// "RLUSD" hex-encoded to 40-char XRPL format (right-padded with zeros)
// R=0x52, L=0x4C, U=0x55, S=0x53, D=0x44
const RLUSD_HEX = "524C555344000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeBalance(currency: string, value: string, issuer?: string): BalanceEntry {
  return { currency, value, ...(issuer ? { issuer } : {}) };
}

function makeTrade(hash: string, account: string): { hash: string; account: string } {
  return { hash, account };
}

// ---------------------------------------------------------------------------
// Tests: buildCurrencyOptions
// ---------------------------------------------------------------------------

describe("buildCurrencyOptions", () => {
  describe("XRP handling", () => {
    it("always includes XRP as the first option", () => {
      const result = buildCurrencyOptions([], [], "mainnet");
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toEqual({
        currency: "XRP",
        label: "XRP",
        value: "XRP|",
      });
    });

    it("XRP is first even when balances and custom currencies are provided", () => {
      const balances = [makeBalance("USD", "100", CUSTOM_ISSUER)];
      const custom = [{ currency: "EUR", issuer: CUSTOM_ISSUER }];
      const result = buildCurrencyOptions(balances, custom, "testnet");
      expect(result[0].currency).toBe("XRP");
      expect(result[0].value).toBe("XRP|");
    });

    it("skips XRP balances (no duplicate XRP entry)", () => {
      const balances = [makeBalance("XRP", "1000"), makeBalance("USD", "50", CUSTOM_ISSUER)];
      const result = buildCurrencyOptions(balances, [], "mainnet");
      const xrpEntries = result.filter((o) => o.currency === "XRP");
      expect(xrpEntries).toHaveLength(1);
    });
  });

  describe("well-known currencies", () => {
    it("includes well-known currencies for mainnet", () => {
      const result = buildCurrencyOptions([], [], "mainnet");
      const rlusd = result.find((o) => o.currency === "RLUSD");
      expect(rlusd).toBeDefined();
      expect(rlusd!.issuer).toBe(RLUSD_ISSUER_MAINNET);
      expect(rlusd!.value).toBe(`RLUSD|${RLUSD_ISSUER_MAINNET}`);
      expect(rlusd!.label).toBe(`RLUSD (${RLUSD_ISSUER_MAINNET})`);

      const bbrl = result.find((o) => o.currency === "BBRL");
      expect(bbrl).toBeDefined();
      expect(bbrl!.issuer).toBe(BBRL_ISSUER_MAINNET);
    });

    it("includes well-known currencies for testnet", () => {
      const result = buildCurrencyOptions([], [], "testnet");
      const rlusd = result.find((o) => o.currency === "RLUSD");
      expect(rlusd).toBeDefined();
      expect(rlusd!.issuer).toBe(RLUSD_ISSUER_TESTNET);

      // BBRL is not defined for testnet
      const bbrl = result.find((o) => o.currency === "BBRL");
      expect(bbrl).toBeUndefined();
    });

    it("includes well-known currencies for devnet", () => {
      const result = buildCurrencyOptions([], [], "devnet");
      const rlusd = result.find((o) => o.currency === "RLUSD");
      expect(rlusd).toBeDefined();
      expect(rlusd!.issuer).toBe(RLUSD_ISSUER_TESTNET); // devnet uses same issuer as testnet
    });

    it("well-known currencies appear after XRP", () => {
      const result = buildCurrencyOptions([], [], "mainnet");
      expect(result[0].currency).toBe("XRP");
      // Well-known currencies should be next
      const wellKnownKeys = Object.keys(WELL_KNOWN_CURRENCIES["mainnet"]);
      for (let i = 0; i < wellKnownKeys.length; i++) {
        expect(result[i + 1].currency).toBe(wellKnownKeys[i]);
      }
    });
  });

  describe("balance-derived currencies", () => {
    it("adds currencies from balances that are not already well-known", () => {
      const balances = [makeBalance("USD", "100", CUSTOM_ISSUER)];
      const result = buildCurrencyOptions(balances, [], "mainnet");
      const usd = result.find((o) => o.currency === "USD" && o.issuer === CUSTOM_ISSUER);
      expect(usd).toBeDefined();
      expect(usd!.label).toBe(`USD (${CUSTOM_ISSUER})`);
      expect(usd!.value).toBe(`USD|${CUSTOM_ISSUER}`);
    });

    it("deduplicates balance currencies against well-known currencies", () => {
      // Balance has RLUSD from the same issuer as the well-known mainnet entry
      const balances = [makeBalance("RLUSD", "500", RLUSD_ISSUER_MAINNET)];
      const result = buildCurrencyOptions(balances, [], "mainnet");
      const rlusdEntries = result.filter((o) => o.currency === "RLUSD");
      expect(rlusdEntries).toHaveLength(1);
    });

    it("allows same currency code from a different issuer", () => {
      // RLUSD from a non-standard issuer (not the well-known one)
      const balances = [makeBalance("RLUSD", "100", CUSTOM_ISSUER)];
      const result = buildCurrencyOptions(balances, [], "mainnet");
      const rlusdEntries = result.filter((o) => o.currency === "RLUSD");
      // Should have 2: one from well-known and one from the balance
      expect(rlusdEntries).toHaveLength(2);
      expect(rlusdEntries[0].issuer).toBe(RLUSD_ISSUER_MAINNET);
      expect(rlusdEntries[1].issuer).toBe(CUSTOM_ISSUER);
    });

    it("decodes hex-encoded currency codes from balances", () => {
      const balances = [makeBalance(RLUSD_HEX, "200", CUSTOM_ISSUER)];
      const result = buildCurrencyOptions(balances, [], "testnet");
      // The hex code should be decoded to "RLUSD"
      const decoded = result.find((o) => o.currency === "RLUSD" && o.issuer === CUSTOM_ISSUER);
      expect(decoded).toBeDefined();
      expect(decoded!.label).toBe(`RLUSD (${CUSTOM_ISSUER})`);
    });

    it("handles balances without an issuer (label has no parenthetical)", () => {
      // Edge case: a balance entry with no issuer (unusual but possible for non-XRP)
      const balances = [makeBalance("FOO", "10")];
      const result = buildCurrencyOptions(balances, [], "mainnet");
      const foo = result.find((o) => o.currency === "FOO");
      expect(foo).toBeDefined();
      expect(foo!.label).toBe("FOO");
      expect(foo!.value).toBe("FOO|");
      expect(foo!.issuer).toBeUndefined();
    });
  });

  describe("custom currencies", () => {
    it("adds custom currencies not present in well-known or balances", () => {
      const custom = [{ currency: "EUR", issuer: CUSTOM_ISSUER }];
      const result = buildCurrencyOptions([], custom, "mainnet");
      const eur = result.find((o) => o.currency === "EUR");
      expect(eur).toBeDefined();
      expect(eur!.issuer).toBe(CUSTOM_ISSUER);
      expect(eur!.label).toBe(`EUR (${CUSTOM_ISSUER})`);
    });

    it("deduplicates custom currencies against well-known currencies", () => {
      const custom = [{ currency: "RLUSD", issuer: RLUSD_ISSUER_MAINNET }];
      const result = buildCurrencyOptions([], custom, "mainnet");
      const rlusdEntries = result.filter((o) => o.currency === "RLUSD");
      expect(rlusdEntries).toHaveLength(1);
    });

    it("deduplicates custom currencies against balance-derived currencies", () => {
      const balances = [makeBalance("USD", "50", CUSTOM_ISSUER)];
      const custom = [{ currency: "USD", issuer: CUSTOM_ISSUER }];
      const result = buildCurrencyOptions(balances, custom, "mainnet");
      const usdEntries = result.filter((o) => o.currency === "USD" && o.issuer === CUSTOM_ISSUER);
      expect(usdEntries).toHaveLength(1);
    });

    it("allows custom currency with same code but different issuer from balance", () => {
      const otherIssuer = "rOTHER5555555555555555555555555555";
      const balances = [makeBalance("USD", "50", CUSTOM_ISSUER)];
      const custom = [{ currency: "USD", issuer: otherIssuer }];
      const result = buildCurrencyOptions(balances, custom, "mainnet");
      const usdEntries = result.filter((o) => o.currency === "USD");
      expect(usdEntries).toHaveLength(2);
    });
  });

  describe("ordering", () => {
    it("returns options in order: XRP, well-known, balances, custom", () => {
      const balances = [makeBalance("USD", "100", CUSTOM_ISSUER)];
      const custom = [{ currency: "EUR", issuer: CUSTOM_ISSUER }];
      const result = buildCurrencyOptions(balances, custom, "mainnet");

      // XRP first
      expect(result[0].currency).toBe("XRP");

      // Well-known next (RLUSD, BBRL for mainnet)
      const wellKnownKeys = Object.keys(WELL_KNOWN_CURRENCIES["mainnet"]);
      for (let i = 0; i < wellKnownKeys.length; i++) {
        expect(result[i + 1].currency).toBe(wellKnownKeys[i]);
      }

      // Then balance-derived
      const usdIdx = result.findIndex((o) => o.currency === "USD" && o.issuer === CUSTOM_ISSUER);
      expect(usdIdx).toBe(1 + wellKnownKeys.length);

      // Then custom
      const eurIdx = result.findIndex((o) => o.currency === "EUR");
      expect(eurIdx).toBe(2 + wellKnownKeys.length);
    });
  });

  describe("edge cases", () => {
    it("returns only XRP when balances and custom are empty and network has no well-known", () => {
      // Use a network with well-known currencies, but no balances/custom
      // For testnet, there is RLUSD. So we get XRP + RLUSD = 2
      const result = buildCurrencyOptions([], [], "testnet");
      expect(result).toHaveLength(2); // XRP + RLUSD
    });

    it("handles multiple balances with some being XRP", () => {
      const balances = [
        makeBalance("XRP", "1000"),
        makeBalance("USD", "100", CUSTOM_ISSUER),
        makeBalance("XRP", "500"), // duplicate XRP
        makeBalance("EUR", "200", CUSTOM_ISSUER),
      ];
      const result = buildCurrencyOptions(balances, [], "mainnet");
      const xrpEntries = result.filter((o) => o.currency === "XRP");
      expect(xrpEntries).toHaveLength(1); // Only the initial XRP
    });

    it("handles duplicate balances (same currency + issuer)", () => {
      const balances = [
        makeBalance("USD", "100", CUSTOM_ISSUER),
        makeBalance("USD", "200", CUSTOM_ISSUER), // duplicate
      ];
      const result = buildCurrencyOptions(balances, [], "mainnet");
      const usdEntries = result.filter((o) => o.currency === "USD" && o.issuer === CUSTOM_ISSUER);
      expect(usdEntries).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: detectNewOwnTrades
// ---------------------------------------------------------------------------

describe("detectNewOwnTrades", () => {
  describe("guard conditions", () => {
    it("returns shouldRefresh=false when address is undefined", () => {
      const seen = new Set<string>();
      const trades = [makeTrade("hash1", WALLET)];
      const result = detectNewOwnTrades(trades, seen, undefined);
      expect(result.shouldRefresh).toBe(false);
      // Seen set should not be modified
      expect(seen.size).toBe(0);
    });

    it("returns shouldRefresh=false when recentTrades is empty", () => {
      const seen = new Set<string>();
      const result = detectNewOwnTrades([], seen, WALLET);
      expect(result.shouldRefresh).toBe(false);
    });

    it("returns shouldRefresh=false when address is undefined and trades are empty", () => {
      const seen = new Set<string>();
      const result = detectNewOwnTrades([], seen, undefined);
      expect(result.shouldRefresh).toBe(false);
    });
  });

  describe("first load (empty seen set)", () => {
    it("seeds the seen-hashes set without triggering refresh", () => {
      const seen = new Set<string>();
      const trades = [
        makeTrade("hash1", WALLET),
        makeTrade("hash2", "rOTHER"),
        makeTrade("hash3", WALLET),
      ];
      const result = detectNewOwnTrades(trades, seen, WALLET);
      expect(result.shouldRefresh).toBe(false);
      expect(seen.size).toBe(3);
      expect(seen.has("hash1")).toBe(true);
      expect(seen.has("hash2")).toBe(true);
      expect(seen.has("hash3")).toBe(true);
    });

    it("does not trigger refresh even when all first-load trades match address", () => {
      const seen = new Set<string>();
      const trades = [makeTrade("hash1", WALLET), makeTrade("hash2", WALLET)];
      const result = detectNewOwnTrades(trades, seen, WALLET);
      expect(result.shouldRefresh).toBe(false);
    });
  });

  describe("subsequent loads (non-empty seen set)", () => {
    it("triggers refresh when a new trade matches the user's address", () => {
      const seen = new Set(["hash1", "hash2"]);
      const trades = [
        makeTrade("hash1", WALLET),
        makeTrade("hash2", "rOTHER"),
        makeTrade("hash3", WALLET), // new trade from own address
      ];
      const result = detectNewOwnTrades(trades, seen, WALLET);
      expect(result.shouldRefresh).toBe(true);
      expect(seen.has("hash3")).toBe(true);
    });

    it("does NOT trigger refresh when new trade is from another account", () => {
      const seen = new Set(["hash1"]);
      const trades = [
        makeTrade("hash1", WALLET),
        makeTrade("hash2", "rOTHER"), // new but not from our address
      ];
      const result = detectNewOwnTrades(trades, seen, WALLET);
      expect(result.shouldRefresh).toBe(false);
      // hash2 should still be added to seen set
      expect(seen.has("hash2")).toBe(true);
    });

    it("ignores duplicate hashes (already in seen set)", () => {
      const seen = new Set(["hash1", "hash2"]);
      const trades = [makeTrade("hash1", WALLET), makeTrade("hash2", WALLET)];
      const result = detectNewOwnTrades(trades, seen, WALLET);
      expect(result.shouldRefresh).toBe(false);
      expect(seen.size).toBe(2); // no change
    });

    it("adds all new hashes to seen set regardless of account", () => {
      const seen = new Set(["hash1"]);
      const trades = [
        makeTrade("hash1", WALLET),
        makeTrade("hash2", "rOTHER_A"),
        makeTrade("hash3", "rOTHER_B"),
        makeTrade("hash4", WALLET),
      ];
      const result = detectNewOwnTrades(trades, seen, WALLET);
      expect(result.shouldRefresh).toBe(true); // hash4 matches
      expect(seen.size).toBe(4);
    });

    it("handles mix of new own trades and new other trades", () => {
      const seen = new Set(["hash1"]);
      const trades = [
        makeTrade("hash1", WALLET),
        makeTrade("hash2", "rOTHER"),
        makeTrade("hash3", WALLET),
      ];
      const result = detectNewOwnTrades(trades, seen, WALLET);
      expect(result.shouldRefresh).toBe(true);
      expect(seen.size).toBe(3);
    });

    it("triggers refresh if at least one of many new trades is own", () => {
      const seen = new Set(["hash1"]);
      const trades = [
        makeTrade("hash1", WALLET),
        makeTrade("hash2", "rOTHER_A"),
        makeTrade("hash3", "rOTHER_B"),
        makeTrade("hash4", "rOTHER_C"),
        makeTrade("hash5", WALLET), // own trade buried among others
      ];
      const result = detectNewOwnTrades(trades, seen, WALLET);
      expect(result.shouldRefresh).toBe(true);
    });
  });

  describe("seen set mutation", () => {
    it("mutates the provided seen set in place", () => {
      const seen = new Set(["existing"]);
      const trades = [makeTrade("existing", WALLET), makeTrade("new_hash", "rOTHER")];
      detectNewOwnTrades(trades, seen, WALLET);
      // The original set should be mutated
      expect(seen.has("new_hash")).toBe(true);
      expect(seen.size).toBe(2);
    });

    it("does not remove any existing hashes from the seen set", () => {
      const seen = new Set(["old_hash_1", "old_hash_2"]);
      const trades = [makeTrade("new_hash", WALLET)];
      detectNewOwnTrades(trades, seen, WALLET);
      expect(seen.has("old_hash_1")).toBe(true);
      expect(seen.has("old_hash_2")).toBe(true);
      expect(seen.has("new_hash")).toBe(true);
    });
  });
});
