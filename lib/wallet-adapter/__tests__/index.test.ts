import { describe, it, expect } from "vitest";
import { createSeedAdapter, getExtensionAdapterTypes, loadExtensionAdapter } from "../index";
import { SeedWalletAdapter } from "../seed-adapter";
import { CrossmarkAdapter } from "../crossmark-adapter";

describe("createSeedAdapter", () => {
  it("returns a SeedWalletAdapter instance", () => {
    const adapter = createSeedAdapter(() => "sTestSeed");
    expect(adapter).toBeInstanceOf(SeedWalletAdapter);
    expect(adapter.type).toBe("seed");
    expect(adapter.displayName).toBe("Seed (Local)");
  });
});

describe("getExtensionAdapterTypes", () => {
  it("returns registered extension adapters", () => {
    const types = getExtensionAdapterTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types.some((t) => t.type === "crossmark")).toBe(true);
  });
});

describe("loadExtensionAdapter", () => {
  it("loads CrossmarkAdapter for type 'crossmark'", async () => {
    const adapter = await loadExtensionAdapter("crossmark");
    expect(adapter).toBeInstanceOf(CrossmarkAdapter);
    expect(adapter.type).toBe("crossmark");
  });

  it("throws for seed type (not an extension)", async () => {
    await expect(loadExtensionAdapter("seed")).rejects.toThrow("No adapter registered");
  });

  it("throws for unregistered types", async () => {
    // gemwallet not yet registered
    await expect(loadExtensionAdapter("gemwallet")).rejects.toThrow("No adapter registered");
  });
});
