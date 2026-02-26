import { describe, it, expect } from "vitest";
import type { BookOffer } from "xrpl";
import { matchesCurrency } from "@/lib/xrpl/match-currency";
import { aggregateDepth } from "@/lib/xrpl/aggregate-depth";
import { normalizeOffer } from "@/lib/xrpl/normalize-offer";

// ---------------------------------------------------------------------------
// matchesCurrency
// ---------------------------------------------------------------------------
describe("matchesCurrency", () => {
  it("XRP matches XRP (no issuer needed)", () => {
    expect(matchesCurrency({ currency: "XRP", value: "10" }, "XRP", undefined)).toBe(true);
  });

  it("XRP does not match USD", () => {
    expect(matchesCurrency({ currency: "XRP", value: "10" }, "USD", undefined)).toBe(false);
  });

  it("issued currency matches with same issuer", () => {
    expect(matchesCurrency({ currency: "USD", value: "10", issuer: "rABC" }, "USD", "rABC")).toBe(
      true,
    );
  });

  it("issued currency does not match with different issuer", () => {
    expect(matchesCurrency({ currency: "USD", value: "10", issuer: "rABC" }, "USD", "rDEF")).toBe(
      false,
    );
  });

  it("issued currency does not match different currency", () => {
    expect(matchesCurrency({ currency: "USD", value: "10", issuer: "rABC" }, "EUR", "rABC")).toBe(
      false,
    );
  });

  it("hex-encoded currency matches decoded name", () => {
    // "RLUSD" hex-encoded right-padded to 40 chars
    const hex = "524C555344000000000000000000000000000000";
    expect(matchesCurrency({ currency: hex, value: "10", issuer: "rABC" }, "RLUSD", "rABC")).toBe(
      true,
    );
  });

  it("raw currency code also matches (fallback)", () => {
    expect(matchesCurrency({ currency: "USD", value: "5", issuer: "rX" }, "USD", "rX")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// aggregateDepth
// ---------------------------------------------------------------------------
describe("aggregateDepth", () => {
  it("empty arrays return zeros", () => {
    const { depth } = aggregateDepth([], []);
    expect(depth).toEqual({
      bidVolume: "0",
      bidLevels: 0,
      askVolume: "0",
      askLevels: 0,
    });
  });

  it("single buy offer", () => {
    const { depth } = aggregateDepth([{ taker_gets: { value: "100" } }], []);
    expect(depth.bidVolume).toBe("100");
    expect(depth.bidLevels).toBe(1);
    expect(depth.askVolume).toBe("0");
    expect(depth.askLevels).toBe(0);
  });

  it("single sell offer", () => {
    const { depth } = aggregateDepth([], [{ taker_gets: { value: "250.5" } }]);
    expect(depth.bidVolume).toBe("0");
    expect(depth.bidLevels).toBe(0);
    expect(depth.askVolume).toBe("250.5");
    expect(depth.askLevels).toBe(1);
  });

  it("multiple offers sum correctly", () => {
    const { depth } = aggregateDepth(
      [
        { taker_gets: { value: "10" } },
        { taker_gets: { value: "20" } },
        { taker_gets: { value: "30" } },
      ],
      [{ taker_gets: { value: "5" } }, { taker_gets: { value: "15" } }],
    );
    expect(depth.bidVolume).toBe("60");
    expect(depth.askVolume).toBe("20");
  });

  it("large numbers preserve BigNumber precision", () => {
    const { depth } = aggregateDepth(
      [
        { taker_gets: { value: "99999999999.123456789" } },
        { taker_gets: { value: "0.000000001" } },
      ],
      [],
    );
    expect(depth.bidVolume).toBe("99999999999.12345679");
  });

  it("level counts match array lengths", () => {
    const buys = Array.from({ length: 7 }, () => ({
      taker_gets: { value: "1" },
    }));
    const sells = Array.from({ length: 3 }, () => ({
      taker_gets: { value: "1" },
    }));
    const { depth } = aggregateDepth(buys, sells);
    expect(depth.bidLevels).toBe(7);
    expect(depth.askLevels).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// normalizeOffer
// ---------------------------------------------------------------------------
describe("normalizeOffer", () => {
  it("XRP-for-token offer: drops string converted to XRP amount", () => {
    const offer = {
      Account: "rSender",
      TakerGets: "10000000", // 10 XRP in drops
      TakerPays: { currency: "USD", issuer: "rXXX", value: "50" },
      quality: "0.000005",
      owner_funds: "50000000",
      Flags: 0,
      Sequence: 42,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result.account).toBe("rSender");
    expect(result.taker_gets).toEqual({ currency: "XRP", value: "10" });
    expect(result.taker_pays).toEqual({
      currency: "USD",
      issuer: "rXXX",
      value: "50",
    });
  });

  it("token-for-XRP offer: inverse direction", () => {
    const offer = {
      Account: "rBuyer",
      TakerGets: { currency: "USD", issuer: "rXXX", value: "25" },
      TakerPays: "5000000", // 5 XRP in drops
      quality: "200000",
      owner_funds: "100",
      Flags: 131072,
      Sequence: 99,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result.taker_gets).toEqual({
      currency: "USD",
      issuer: "rXXX",
      value: "25",
    });
    expect(result.taker_pays).toEqual({ currency: "XRP", value: "5" });
  });

  it("preserves account, quality, owner_funds, flags, sequence", () => {
    const offer = {
      Account: "rAccount123",
      TakerGets: "1000000",
      TakerPays: { currency: "EUR", issuer: "rIssuer", value: "10" },
      quality: "0.00001",
      owner_funds: "999000000",
      Flags: 65536,
      Sequence: 7,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result.account).toBe("rAccount123");
    expect(result.quality).toBe("0.00001");
    expect(result.owner_funds).toBe("999000000");
    expect(result.flags).toBe(65536);
    expect(result.sequence).toBe(7);
  });

  it("token-for-token offer: both sides are currency objects", () => {
    const offer = {
      Account: "rTrader",
      TakerGets: { currency: "USD", issuer: "rIssuerA", value: "100" },
      TakerPays: { currency: "EUR", issuer: "rIssuerB", value: "90" },
      quality: "0.9",
      owner_funds: "500",
      Flags: 0,
      Sequence: 55,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result.taker_gets).toEqual({
      currency: "USD",
      issuer: "rIssuerA",
      value: "100",
    });
    expect(result.taker_pays).toEqual({
      currency: "EUR",
      issuer: "rIssuerB",
      value: "90",
    });
  });
});
