import { deduplicateByHash } from "./deduplication";

describe("deduplicateByHash", () => {
  it("returns empty array for empty input", () => {
    expect(deduplicateByHash([])).toEqual([]);
  });

  it("passes through array with no duplicates unchanged", () => {
    const items = [{ hash: "a" }, { hash: "b" }, { hash: "c" }];
    expect(deduplicateByHash(items)).toEqual(items);
  });

  it("removes duplicates, keeping first occurrence", () => {
    const first = { hash: "a", value: 1 };
    const duplicate = { hash: "a", value: 2 };
    const result = deduplicateByHash([first, duplicate]);
    expect(result).toEqual([first]);
  });

  it("preserves order", () => {
    const items = [
      { hash: "c" },
      { hash: "a" },
      { hash: "b" },
      { hash: "a" },
      { hash: "c" },
    ];
    expect(deduplicateByHash(items)).toEqual([
      { hash: "c" },
      { hash: "a" },
      { hash: "b" },
    ]);
  });

  it("works with extra properties beyond hash", () => {
    const items = [
      { hash: "x", name: "first", count: 1 },
      { hash: "y", name: "second", count: 2 },
      { hash: "x", name: "third", count: 3 },
    ];
    const result = deduplicateByHash(items);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ hash: "x", name: "first", count: 1 });
    expect(result[1]).toEqual({ hash: "y", name: "second", count: 2 });
  });
});
