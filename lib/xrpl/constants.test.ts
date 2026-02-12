import {
  RIPPLE_EPOCH_OFFSET,
  toRippleEpoch,
  fromRippleEpoch,
} from "./constants";

describe("RIPPLE_EPOCH_OFFSET", () => {
  it("equals 946684800 (seconds between 1970-01-01 and 2000-01-01)", () => {
    expect(RIPPLE_EPOCH_OFFSET).toBe(946684800);
  });
});

describe("toRippleEpoch", () => {
  it("converts the Ripple epoch start date to 0", () => {
    const rippleEpochStart = new Date("2000-01-01T00:00:00Z");
    expect(toRippleEpoch(rippleEpochStart)).toBe(0);
  });

  it("converts a Date object to the correct Ripple epoch timestamp", () => {
    // 2024-01-01T00:00:00Z
    const date = new Date("2024-01-01T00:00:00Z");
    const unixSeconds = Math.floor(date.getTime() / 1000);
    const expected = unixSeconds - RIPPLE_EPOCH_OFFSET;
    expect(toRippleEpoch(date)).toBe(expected);
  });

  it("converts an epoch-ms number to the correct Ripple epoch timestamp", () => {
    // 2000-01-01T00:00:00Z in ms
    const epochMs = 946684800000;
    expect(toRippleEpoch(epochMs)).toBe(0);
  });

  it("converts a later epoch-ms number correctly", () => {
    // 2020-01-01T00:00:00Z = 1577836800 unix seconds
    const epochMs = 1577836800000;
    const expected = 1577836800 - RIPPLE_EPOCH_OFFSET;
    expect(toRippleEpoch(epochMs)).toBe(expected);
  });

  it("floors fractional seconds", () => {
    // 2000-01-01T00:00:00.999Z = 946684800999 ms
    const epochMs = 946684800999;
    // Math.floor(946684800999 / 1000) = 946684800, minus offset = 0
    expect(toRippleEpoch(epochMs)).toBe(0);
  });
});

describe("fromRippleEpoch", () => {
  it("converts 0 to the Ripple epoch start (2000-01-01T00:00:00Z)", () => {
    const date = fromRippleEpoch(0);
    expect(date.toISOString()).toBe("2000-01-01T00:00:00.000Z");
  });

  it("converts a positive Ripple timestamp to the correct Date", () => {
    // 631152000 Ripple seconds = 2020-01-01T00:00:00Z
    const rippleTs = 1577836800 - RIPPLE_EPOCH_OFFSET; // 631152000
    const date = fromRippleEpoch(rippleTs);
    expect(date.toISOString()).toBe("2020-01-01T00:00:00.000Z");
  });

  it("converts a negative Ripple timestamp to a date before 2000", () => {
    // -1 Ripple second = 1999-12-31T23:59:59Z
    const date = fromRippleEpoch(-1);
    expect(date.toISOString()).toBe("1999-12-31T23:59:59.000Z");
  });
});

describe("round-trip conversion", () => {
  it("toRippleEpoch(fromRippleEpoch(n)) === n", () => {
    const values = [0, 1, 100000, 631152000, 757382400];
    for (const n of values) {
      expect(toRippleEpoch(fromRippleEpoch(n))).toBe(n);
    }
  });

  it("fromRippleEpoch(toRippleEpoch(date)).getTime() === date.getTime() (to the second)", () => {
    const dates = [
      new Date("2000-01-01T00:00:00Z"),
      new Date("2024-06-15T12:30:00Z"),
      new Date("2010-03-20T08:00:00Z"),
    ];
    for (const date of dates) {
      const roundTripped = fromRippleEpoch(toRippleEpoch(date));
      // Should match to the second (ms are truncated by toRippleEpoch)
      expect(roundTripped.getTime()).toBe(date.getTime());
    }
  });
});
