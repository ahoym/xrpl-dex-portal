import { getSigningLoadingText, extractErrorMessage } from "./wallet-ui";

describe("getSigningLoadingText", () => {
  it("returns fallback for null adapter", () => {
    expect(getSigningLoadingText(null)).toBe("Creating...");
  });

  it("returns fallback for seed adapter", () => {
    expect(
      getSigningLoadingText({ type: "seed", displayName: "Seed" }),
    ).toBe("Creating...");
  });

  it("returns 'Confirm in {name}...' for extension adapter", () => {
    expect(
      getSigningLoadingText({ type: "crossmark", displayName: "Crossmark" }),
    ).toBe("Confirm in Crossmark...");

    expect(
      getSigningLoadingText({ type: "xaman", displayName: "Xaman" }),
    ).toBe("Confirm in Xaman...");
  });

  it("uses custom fallback when provided", () => {
    expect(getSigningLoadingText(null, "Sending...")).toBe("Sending...");
    expect(
      getSigningLoadingText({ type: "seed", displayName: "Seed" }, "Sending..."),
    ).toBe("Sending...");
  });
});

describe("extractErrorMessage", () => {
  it("returns error message from Error instance", () => {
    expect(extractErrorMessage(new Error("Something went wrong"))).toBe(
      "Something went wrong",
    );
  });

  it("returns fallback for non-Error values", () => {
    expect(extractErrorMessage("string error")).toBe("Network error");
    expect(extractErrorMessage(42)).toBe("Network error");
    expect(extractErrorMessage(null)).toBe("Network error");
    expect(extractErrorMessage(undefined)).toBe("Network error");
  });

  it("uses custom fallback when provided", () => {
    expect(extractErrorMessage("oops", "Custom fallback")).toBe(
      "Custom fallback",
    );
  });

  it('uses "Network error" as default fallback', () => {
    expect(extractErrorMessage({})).toBe("Network error");
  });
});
