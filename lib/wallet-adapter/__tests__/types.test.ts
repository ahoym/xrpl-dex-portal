import { describe, it, expect } from "vitest";
import type { WalletAdapter, TxResult, PaymentParams, CreateOfferParams, CancelOfferParams, TrustlineParams } from "../types";

describe("wallet-adapter/types", () => {
  it("TxResult shape is correct", () => {
    const result: TxResult = { hash: "ABC123", success: true, resultCode: "tesSUCCESS" };
    expect(result.hash).toBe("ABC123");
    expect(result.success).toBe(true);
    expect(result.resultCode).toBe("tesSUCCESS");
  });

  it("TxResult works without optional resultCode", () => {
    const result: TxResult = { hash: "DEF456", success: false };
    expect(result.resultCode).toBeUndefined();
  });

  it("PaymentParams includes all required fields", () => {
    const params: PaymentParams = {
      recipientAddress: "rXXX",
      currencyCode: "XRP",
      amount: "100",
      network: "testnet",
    };
    expect(params.recipientAddress).toBe("rXXX");
    expect(params.issuerAddress).toBeUndefined();
    expect(params.destinationTag).toBeUndefined();
  });

  it("CreateOfferParams includes all required fields", () => {
    const params: CreateOfferParams = {
      takerGets: { currency: "XRP", value: "100" },
      takerPays: { currency: "USD", issuer: "rISSUER", value: "50" },
      network: "testnet",
    };
    expect(params.takerGets.currency).toBe("XRP");
    expect(params.flags).toBeUndefined();
    expect(params.expiration).toBeUndefined();
  });

  it("CancelOfferParams includes all required fields", () => {
    const params: CancelOfferParams = { offerSequence: 42, network: "testnet" };
    expect(params.offerSequence).toBe(42);
  });

  it("TrustlineParams includes all required fields", () => {
    const params: TrustlineParams = {
      address: "rADDRESS",
      currency: "USD",
      issuer: "rISSUER",
      limit: "1000000",
      network: "testnet",
    };
    expect(params.currency).toBe("USD");
  });

  it("WalletAdapter interface has the expected methods", () => {
    // This test verifies the interface compiles correctly with a mock
    const mockAdapter: WalletAdapter = {
      type: "seed",
      displayName: "Test",
      isAvailable: async () => true,
      connect: async () => ({ address: "rABC", publicKey: "PK" }),
      disconnect: () => {},
      sendPayment: async () => ({ hash: "h1", success: true }),
      createOffer: async () => ({ hash: "h2", success: true }),
      cancelOffer: async () => ({ hash: "h3", success: true }),
      setTrustline: async () => ({ hash: "h4", success: true }),
    };
    expect(mockAdapter.type).toBe("seed");
    expect(mockAdapter.displayName).toBe("Test");
  });
});
