import { formatTime, formatDateTime } from "./format-time";

describe("formatTime", () => {
  it("returns '—' for empty string", () => {
    expect(formatTime("")).toBe("—");
  });

  it("returns '—' for invalid date string", () => {
    expect(formatTime("not-a-date")).toBe("—");
  });

  it("returns a time string for valid ISO input", () => {
    const result = formatTime("2024-01-15T14:30:45Z");
    // Should contain HH:MM:SS pattern (locale-dependent separators)
    expect(result).toMatch(/\d{1,2}.\d{2}.\d{2}/);
  });
});

describe("formatDateTime", () => {
  it("returns empty string for empty input", () => {
    expect(formatDateTime("")).toBe("");
  });

  it("returns a locale string for valid ISO input", () => {
    const result = formatDateTime("2024-01-15T14:30:45Z");
    expect(result.length).toBeGreaterThan(0);
    // Should contain date components
    expect(result).toMatch(/\d/);
  });
});
