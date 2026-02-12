import { parseDestinationTag } from "./destination-tag";

describe("parseDestinationTag", () => {
  it("returns { tag: undefined } for empty string", () => {
    expect(parseDestinationTag("")).toEqual({ tag: undefined });
  });

  it("returns { tag: undefined } for whitespace-only string", () => {
    expect(parseDestinationTag("   ")).toEqual({ tag: undefined });
  });

  it('returns { tag: 0 } for "0"', () => {
    expect(parseDestinationTag("0")).toEqual({ tag: 0 });
  });

  it('returns { tag: 12345 } for "12345"', () => {
    expect(parseDestinationTag("12345")).toEqual({ tag: 12345 });
  });

  it("trims leading/trailing whitespace", () => {
    expect(parseDestinationTag("  42  ")).toEqual({ tag: 42 });
  });

  it("returns error for negative number", () => {
    const result = parseDestinationTag("-1");
    expect(result.error).toBeDefined();
    expect(result.tag).toBeUndefined();
  });

  it("returns error for non-numeric string", () => {
    const result = parseDestinationTag("abc");
    expect(result.error).toBeDefined();
    expect(result.tag).toBeUndefined();
  });

  it("truncates decimal via parseInt", () => {
    // parseInt("3.14", 10) → 3 which is valid
    const result = parseDestinationTag("3.14");
    expect(result.tag).toBe(3);
  });
});
