import { aggregateDepth } from "./aggregate-depth";

describe("aggregateDepth", () => {
  it("returns zero volume and zero levels for empty arrays", () => {
    const { depth } = aggregateDepth([], []);

    expect(depth.bidVolume).toBe("0");
    expect(depth.bidLevels).toBe(0);
    expect(depth.askVolume).toBe("0");
    expect(depth.askLevels).toBe(0);
  });

  it("computes correct bid volume and levels for a single buy offer", () => {
    const buy = [{ taker_gets: { value: "100.5" } }];
    const { depth } = aggregateDepth(buy, []);

    expect(depth.bidVolume).toBe("100.5");
    expect(depth.bidLevels).toBe(1);
    expect(depth.askVolume).toBe("0");
    expect(depth.askLevels).toBe(0);
  });

  it("computes correct ask volume and levels for a single sell offer", () => {
    const sell = [{ taker_gets: { value: "250" } }];
    const { depth } = aggregateDepth([], sell);

    expect(depth.bidVolume).toBe("0");
    expect(depth.bidLevels).toBe(0);
    expect(depth.askVolume).toBe("250");
    expect(depth.askLevels).toBe(1);
  });

  it("sums multiple offers on each side correctly", () => {
    const buy = [
      { taker_gets: { value: "10" } },
      { taker_gets: { value: "20" } },
      { taker_gets: { value: "30" } },
    ];
    const sell = [
      { taker_gets: { value: "5" } },
      { taker_gets: { value: "15" } },
    ];
    const { depth } = aggregateDepth(buy, sell);

    expect(depth.bidVolume).toBe("60");
    expect(depth.bidLevels).toBe(3);
    expect(depth.askVolume).toBe("20");
    expect(depth.askLevels).toBe(2);
  });

  it("uses taker_gets_funded when available instead of taker_gets", () => {
    const buy = [
      { taker_gets: { value: "100" }, taker_gets_funded: { value: "75" } },
    ];
    const sell = [
      { taker_gets: { value: "200" }, taker_gets_funded: { value: "150" } },
    ];
    const { depth } = aggregateDepth(buy, sell);

    expect(depth.bidVolume).toBe("75");
    expect(depth.bidLevels).toBe(1);
    expect(depth.askVolume).toBe("150");
    expect(depth.askLevels).toBe(1);
  });

  it("skips offers with zero taker_gets value", () => {
    const buy = [
      { taker_gets: { value: "50" } },
      { taker_gets: { value: "0" } },
    ];
    const { depth } = aggregateDepth(buy, []);

    expect(depth.bidVolume).toBe("50");
    expect(depth.bidLevels).toBe(1);
  });

  it("skips offers with zero taker_gets_funded value", () => {
    const sell = [
      { taker_gets: { value: "100" }, taker_gets_funded: { value: "0" } },
      { taker_gets: { value: "200" } },
    ];
    const { depth } = aggregateDepth([], sell);

    expect(depth.askVolume).toBe("200");
    expect(depth.askLevels).toBe(1);
  });

  it("handles mixed offers where some have funded amounts and some do not", () => {
    const buy = [
      { taker_gets: { value: "100" }, taker_gets_funded: { value: "80" } },
      { taker_gets: { value: "50" } },
      { taker_gets: { value: "200" }, taker_gets_funded: { value: "0" } },
    ];
    const { depth } = aggregateDepth(buy, []);

    // 80 (funded) + 50 (unfunded, no funded key) = 130; the zero-funded offer is skipped
    expect(depth.bidVolume).toBe("130");
    expect(depth.bidLevels).toBe(2);
  });

  it("handles decimal precision correctly with BigNumber", () => {
    const buy = [
      { taker_gets: { value: "0.1" } },
      { taker_gets: { value: "0.2" } },
    ];
    const { depth } = aggregateDepth(buy, []);

    // BigNumber avoids floating-point issues: 0.1 + 0.2 = 0.3 exactly
    expect(depth.bidVolume).toBe("0.3");
    expect(depth.bidLevels).toBe(2);
  });
});
