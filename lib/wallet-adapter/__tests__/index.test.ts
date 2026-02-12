import { describe, it, expect } from "vitest";
import { createSeedAdapter, getExtensionAdapterTypes, loadExtensionAdapter } from "../index";
import { SeedWalletAdapter } from "../seed-adapter";

describe("createSeedAdapter", () => {
  it("returns a SeedWalletAdapter instance", () => {
    const adapter = createSeedAdapter(() => "sTestSeed");
    expect(adapter).toBeInstanceOf(SeedWalletAdapter);
    expect(adapter.type).toBe("seed");
    expect(adapter.displayName).toBe("Seed (Local)");
  });
});

describe("getExtensionAdapterTypes", () => {
  it("returns an array (empty until extension adapters are registered)", () => {
    const types = getExtensionAdapterTypes();
    expect(Array.isArray(types)).toBe(true);
  });
});

describe("loadExtensionAdapter", () => {
  it("throws for unregistered wallet type", async () => {
    await expect(loadExtensionAdapter("crossmark")).rejects.toThrow("No adapter registered");
  });

  it("throws for unknown wallet type", async () => {
    await expect(loadExtensionAdapter("seed")).rejects.toThrow("No adapter registered");
  });
});
