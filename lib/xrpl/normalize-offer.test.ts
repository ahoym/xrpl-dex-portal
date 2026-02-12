import type { BookOffer } from "xrpl";
import { normalizeOffer } from "./normalize-offer";

describe("normalizeOffer", () => {
  it("normalizes an XRP-only offer (drops strings)", () => {
    const offer = {
      Account: "rAccount1",
      TakerGets: "10000000", // 10 XRP in drops
      TakerPays: "20000000", // 20 XRP in drops
      quality: "0.5",
      owner_funds: "50000000",
      Flags: 0,
      Sequence: 42,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result).toEqual({
      account: "rAccount1",
      taker_gets: { currency: "XRP", value: "10" },
      taker_pays: { currency: "XRP", value: "20" },
      quality: "0.5",
      owner_funds: "50000000",
      flags: 0,
      sequence: 42,
    });
  });

  it("normalizes an issued currency offer (object amounts)", () => {
    const offer = {
      Account: "rAccount2",
      TakerGets: { currency: "USD", issuer: "rIssuer1", value: "100" },
      TakerPays: { currency: "EUR", issuer: "rIssuer2", value: "90" },
      quality: "1.111",
      owner_funds: "500",
      Flags: 131072,
      Sequence: 7,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result).toEqual({
      account: "rAccount2",
      taker_gets: { currency: "USD", issuer: "rIssuer1", value: "100" },
      taker_pays: { currency: "EUR", issuer: "rIssuer2", value: "90" },
      quality: "1.111",
      owner_funds: "500",
      flags: 131072,
      sequence: 7,
    });
  });

  it("includes funded amounts when taker_gets_funded and taker_pays_funded are present", () => {
    const offer = {
      Account: "rAccount3",
      TakerGets: "50000000",
      TakerPays: { currency: "USD", issuer: "rIssuer1", value: "25" },
      taker_gets_funded: "30000000",
      taker_pays_funded: { currency: "USD", issuer: "rIssuer1", value: "15" },
      quality: "2.0",
      owner_funds: "30000000",
      Flags: 0,
      Sequence: 100,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result).toEqual({
      account: "rAccount3",
      taker_gets: { currency: "XRP", value: "50" },
      taker_pays: { currency: "USD", issuer: "rIssuer1", value: "25" },
      taker_gets_funded: { currency: "XRP", value: "30" },
      taker_pays_funded: { currency: "USD", issuer: "rIssuer1", value: "15" },
      quality: "2.0",
      owner_funds: "30000000",
      flags: 0,
      sequence: 100,
    });
  });

  it("omits funded amount keys when not present on the offer", () => {
    const offer = {
      Account: "rAccount4",
      TakerGets: "1000000",
      TakerPays: "2000000",
      quality: "0.5",
      owner_funds: "1000000",
      Flags: 0,
      Sequence: 1,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result).not.toHaveProperty("taker_gets_funded");
    expect(result).not.toHaveProperty("taker_pays_funded");
  });

  it("maps all fields correctly", () => {
    const offer = {
      Account: "rMapped",
      TakerGets: "5000000",
      TakerPays: "10000000",
      quality: "0.123456",
      owner_funds: "99999999",
      Flags: 65536,
      Sequence: 999,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result.account).toBe("rMapped");
    expect(result.quality).toBe("0.123456");
    expect(result.owner_funds).toBe("99999999");
    expect(result.flags).toBe(65536);
    expect(result.sequence).toBe(999);
  });

  it("decodes hex-encoded currency codes in issued currency amounts", () => {
    const hexRLUSD = "524C555344000000000000000000000000000000";
    const offer = {
      Account: "rAccount5",
      TakerGets: { currency: hexRLUSD, issuer: "rIssuer1", value: "50" },
      TakerPays: "25000000",
      quality: "2.0",
      owner_funds: "100",
      Flags: 0,
      Sequence: 10,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result.taker_gets.currency).toBe("RLUSD");
    expect(result.taker_gets.issuer).toBe("rIssuer1");
    expect(result.taker_gets.value).toBe("50");
  });

  it("handles mixed XRP and issued currency amounts", () => {
    const offer = {
      Account: "rMixed",
      TakerGets: "15000000", // 15 XRP
      TakerPays: { currency: "USD", issuer: "rIssuer1", value: "7.5" },
      quality: "2.0",
      owner_funds: "15000000",
      Flags: 0,
      Sequence: 55,
    } as unknown as BookOffer;

    const result = normalizeOffer(offer);

    expect(result.taker_gets).toEqual({ currency: "XRP", value: "15" });
    expect(result.taker_pays).toEqual({ currency: "USD", issuer: "rIssuer1", value: "7.5" });
  });
});
