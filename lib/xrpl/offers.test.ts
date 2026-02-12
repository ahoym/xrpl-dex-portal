import { OfferCreateFlags } from "xrpl";
import { VALID_OFFER_FLAGS, resolveOfferFlags } from "./offers";
import type { OfferFlag } from "./types";

describe("VALID_OFFER_FLAGS", () => {
  it("contains all 4 flag names", () => {
    expect(VALID_OFFER_FLAGS).toHaveLength(4);
    expect(VALID_OFFER_FLAGS).toContain("passive");
    expect(VALID_OFFER_FLAGS).toContain("immediateOrCancel");
    expect(VALID_OFFER_FLAGS).toContain("fillOrKill");
    expect(VALID_OFFER_FLAGS).toContain("sell");
  });
});

describe("resolveOfferFlags", () => {
  it("returns undefined for undefined input", () => {
    expect(resolveOfferFlags(undefined)).toBeUndefined();
  });

  it("returns undefined for empty array", () => {
    expect(resolveOfferFlags([])).toBeUndefined();
  });

  it("returns correct numeric value for passive flag", () => {
    expect(resolveOfferFlags(["passive"])).toBe(OfferCreateFlags.tfPassive);
  });

  it("returns correct numeric value for immediateOrCancel flag", () => {
    expect(resolveOfferFlags(["immediateOrCancel"])).toBe(
      OfferCreateFlags.tfImmediateOrCancel,
    );
  });

  it("returns correct numeric value for fillOrKill flag", () => {
    expect(resolveOfferFlags(["fillOrKill"])).toBe(
      OfferCreateFlags.tfFillOrKill,
    );
  });

  it("returns correct numeric value for sell flag", () => {
    expect(resolveOfferFlags(["sell"])).toBe(OfferCreateFlags.tfSell);
  });

  it("returns bitwise OR for multiple flags", () => {
    const flags: OfferFlag[] = ["passive", "sell"];
    const expected = OfferCreateFlags.tfPassive | OfferCreateFlags.tfSell;
    expect(resolveOfferFlags(flags)).toBe(expected);
  });

  it("returns bitwise OR of all four flags combined", () => {
    const flags: OfferFlag[] = ["passive", "immediateOrCancel", "fillOrKill", "sell"];
    const expected =
      OfferCreateFlags.tfPassive |
      OfferCreateFlags.tfImmediateOrCancel |
      OfferCreateFlags.tfFillOrKill |
      OfferCreateFlags.tfSell;
    expect(resolveOfferFlags(flags)).toBe(expected);
  });

  it("returns a number (not undefined) for any non-empty flag array", () => {
    const result = resolveOfferFlags(["sell"]);
    expect(typeof result).toBe("number");
  });
});
