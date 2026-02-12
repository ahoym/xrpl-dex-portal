import { describe, it, expect } from "vitest";
import { createSeedAdapter, getExtensionAdapterTypes, loadExtensionAdapter } from "../index";
import { SeedWalletAdapter } from "../seed-adapter";
import { CrossmarkAdapter } from "../crossmark-adapter";
import { GemWalletAdapter } from "../gemwallet-adapter";

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
    expect(types.some((t) => t.type === "gemwallet")).toBe(true);
  });
});

describe("loadExtensionAdapter", () => {
  it("loads CrossmarkAdapter", async () => {
    const adapter = await loadExtensionAdapter("crossmark");
    expect(adapter).toBeInstanceOf(CrossmarkAdapter);
  });

  it("loads GemWalletAdapter", async () => {
    const adapter = await loadExtensionAdapter("gemwallet");
    expect(adapter).toBeInstanceOf(GemWalletAdapter);
  });

  it("throws for seed type (not an extension)", async () => {
    await expect(loadExtensionAdapter("seed")).rejects.toThrow("No adapter registered");
  });

  it("throws for unregistered types", async () => {
    // xaman and metamask-snap not yet registered
    await expect(loadExtensionAdapter("xaman")).rejects.toThrow("No adapter registered");
    await expect(loadExtensionAdapter("metamask-snap")).rejects.toThrow("No adapter registered");
  });
});
