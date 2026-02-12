import { TEC_MESSAGES, friendlyTxError } from "./transaction-errors";

describe("friendlyTxError", () => {
  it("returns the specific message for tecPATH_DRY", () => {
    expect(friendlyTxError("tecPATH_DRY")).toBe(TEC_MESSAGES["tecPATH_DRY"]);
  });

  it("returns the specific message for tecPATH_PARTIAL", () => {
    expect(friendlyTxError("tecPATH_PARTIAL")).toBe(TEC_MESSAGES["tecPATH_PARTIAL"]);
  });

  it("returns the specific message for tecNO_LINE", () => {
    expect(friendlyTxError("tecNO_LINE")).toBe(TEC_MESSAGES["tecNO_LINE"]);
  });

  it("returns the specific message for tecNO_LINE_INSUF_RESERVE", () => {
    expect(friendlyTxError("tecNO_LINE_INSUF_RESERVE")).toBe(TEC_MESSAGES["tecNO_LINE_INSUF_RESERVE"]);
  });

  it("returns the specific message for tecUNFUNDED_PAYMENT", () => {
    expect(friendlyTxError("tecUNFUNDED_PAYMENT")).toBe(TEC_MESSAGES["tecUNFUNDED_PAYMENT"]);
  });

  it("returns the specific message for tecNO_DST", () => {
    expect(friendlyTxError("tecNO_DST")).toBe(TEC_MESSAGES["tecNO_DST"]);
  });

  it("returns the specific message for tecNO_DST_INSUF_XRP", () => {
    expect(friendlyTxError("tecNO_DST_INSUF_XRP")).toBe(TEC_MESSAGES["tecNO_DST_INSUF_XRP"]);
  });

  it("returns the specific message for tecNO_PERMISSION", () => {
    expect(friendlyTxError("tecNO_PERMISSION")).toBe(TEC_MESSAGES["tecNO_PERMISSION"]);
  });

  it("returns the specific message for tecINSUF_RESERVE_LINE", () => {
    expect(friendlyTxError("tecINSUF_RESERVE_LINE")).toBe(TEC_MESSAGES["tecINSUF_RESERVE_LINE"]);
  });

  it("returns the specific message for tecFROZEN", () => {
    expect(friendlyTxError("tecFROZEN")).toBe(TEC_MESSAGES["tecFROZEN"]);
  });

  it("returns fallback for unknown engine result code", () => {
    expect(friendlyTxError("tecSOME_UNKNOWN_CODE")).toBe(
      "The transaction was rejected by the ledger.",
    );
  });

  it("returns fallback for empty string", () => {
    expect(friendlyTxError("")).toBe(
      "The transaction was rejected by the ledger.",
    );
  });

  it("returns fallback for tesSUCCESS (not in the map)", () => {
    expect(friendlyTxError("tesSUCCESS")).toBe(
      "The transaction was rejected by the ledger.",
    );
  });
});

describe("TEC_MESSAGES", () => {
  it("contains exactly 10 entries", () => {
    expect(Object.keys(TEC_MESSAGES)).toHaveLength(10);
  });

  it("all values are non-empty strings", () => {
    for (const [key, value] of Object.entries(TEC_MESSAGES)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
