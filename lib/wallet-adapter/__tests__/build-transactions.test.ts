import { describe, it, expect } from "vitest";
import { buildPaymentTx, buildOfferCreateTx, buildOfferCancelTx, buildTrustSetTx } from "../build-transactions";

describe("buildPaymentTx", () => {
  it("builds an XRP payment (amount in drops)", () => {
    const tx = buildPaymentTx(
      { recipientAddress: "rDEST", currencyCode: "XRP", amount: "10", network: "testnet" },
      "rSENDER",
    );
    expect(tx.TransactionType).toBe("Payment");
    expect(tx.Account).toBe("rSENDER");
    expect(tx.Destination).toBe("rDEST");
    expect(tx.Amount).toBe("10000000"); // 10 XRP = 10_000_000 drops
    expect(tx.DestinationTag).toBeUndefined();
  });

  it("builds an issued-currency payment", () => {
    const tx = buildPaymentTx(
      {
        recipientAddress: "rDEST",
        currencyCode: "USD",
        amount: "50",
        issuerAddress: "rISSUER",
        network: "testnet",
      },
      "rSENDER",
    );
    expect(tx.Amount).toEqual({ currency: "USD", issuer: "rISSUER", value: "50" });
  });

  it("includes DestinationTag when provided", () => {
    const tx = buildPaymentTx(
      { recipientAddress: "rDEST", currencyCode: "XRP", amount: "1", destinationTag: 99, network: "testnet" },
      "rSENDER",
    );
    expect(tx.DestinationTag).toBe(99);
  });

  it("hex-encodes non-standard currency codes (4+ chars)", () => {
    const tx = buildPaymentTx(
      { recipientAddress: "rDEST", currencyCode: "RLUSD", amount: "100", issuerAddress: "rI", network: "testnet" },
      "rSENDER",
    );
    const amt = tx.Amount as { currency: string };
    // "RLUSD" → hex-encoded + padded to 40 chars
    expect(amt.currency).toHaveLength(40);
    expect(amt.currency).toMatch(/^[0-9A-F]+$/);
  });
});

describe("buildOfferCreateTx", () => {
  it("builds an OfferCreate with XRP and issued currency", () => {
    const tx = buildOfferCreateTx(
      {
        takerGets: { currency: "XRP", value: "100" },
        takerPays: { currency: "USD", issuer: "rI", value: "50" },
        network: "testnet",
      },
      "rACCOUNT",
    );
    expect(tx.TransactionType).toBe("OfferCreate");
    expect(tx.Account).toBe("rACCOUNT");
    expect(tx.TakerGets).toBe("100000000"); // 100 XRP in drops
    expect(tx.TakerPays).toEqual({ currency: "USD", issuer: "rI", value: "50" });
    expect(tx.Flags).toBeUndefined();
    expect(tx.Expiration).toBeUndefined();
  });

  it("resolves offer flags", () => {
    const tx = buildOfferCreateTx(
      {
        takerGets: { currency: "XRP", value: "1" },
        takerPays: { currency: "USD", issuer: "rI", value: "1" },
        flags: ["passive"],
        network: "testnet",
      },
      "rACCOUNT",
    );
    expect(tx.Flags).toBeDefined();
    expect(typeof tx.Flags).toBe("number");
  });

  it("includes expiration when provided", () => {
    const tx = buildOfferCreateTx(
      {
        takerGets: { currency: "XRP", value: "1" },
        takerPays: { currency: "USD", issuer: "rI", value: "1" },
        expiration: 700000000,
        network: "testnet",
      },
      "rACCOUNT",
    );
    expect(tx.Expiration).toBe(700000000);
  });
});

describe("buildOfferCancelTx", () => {
  it("builds an OfferCancel", () => {
    const tx = buildOfferCancelTx({ offerSequence: 42, network: "testnet" }, "rACCOUNT");
    expect(tx.TransactionType).toBe("OfferCancel");
    expect(tx.Account).toBe("rACCOUNT");
    expect(tx.OfferSequence).toBe(42);
  });
});

describe("buildTrustSetTx", () => {
  it("builds a TrustSet with standard currency code", () => {
    const tx = buildTrustSetTx(
      { address: "rADDR", currency: "USD", issuer: "rISSUER", limit: "1000000", network: "testnet" },
      "rADDR",
    );
    expect(tx.TransactionType).toBe("TrustSet");
    expect(tx.Account).toBe("rADDR");
    expect(tx.LimitAmount).toEqual({ currency: "USD", issuer: "rISSUER", value: "1000000" });
  });

  it("hex-encodes non-standard currency codes", () => {
    const tx = buildTrustSetTx(
      { address: "rADDR", currency: "RLUSD", issuer: "rISSUER", limit: "1000000", network: "testnet" },
      "rADDR",
    );
    const limit = tx.LimitAmount as { currency: string };
    expect(limit.currency).toHaveLength(40);
    expect(limit.currency).toMatch(/^[0-9A-F]+$/);
  });
});
