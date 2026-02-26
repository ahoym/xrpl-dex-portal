import { describe, it, expect } from "vitest";
import { createSeedAdapter, getExtensionAdapterTypes, loadExtensionAdapter } from "../index";
import { SeedWalletAdapter } from "../seed-adapter";
import { CrossmarkAdapter } from "../crossmark-adapter";
import { GemWalletAdapter } from "../gemwallet-adapter";
import { XamanAdapter } from "../xaman-adapter";
import { MetaMaskSnapAdapter } from "../metamask-snap-adapter";

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
    expect(types.some((t) => t.type === "xaman")).toBe(true);
    expect(types.some((t) => t.type === "metamask-snap")).toBe(true);
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

  it("loads XamanAdapter", async () => {
    const adapter = await loadExtensionAdapter("xaman");
    expect(adapter).toBeInstanceOf(XamanAdapter);
  });

  it("loads MetaMaskSnapAdapter", async () => {
    const adapter = await loadExtensionAdapter("metamask-snap");
    expect(adapter).toBeInstanceOf(MetaMaskSnapAdapter);
  });

  it("throws for seed type (not an extension)", async () => {
    await expect(loadExtensionAdapter("seed")).rejects.toThrow("No adapter registered");
  });

  it("throws for unregistered types", async () => {
    // All known types are registered — test a completely unknown type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(loadExtensionAdapter("unknown-wallet" as any)).rejects.toThrow(
      "No adapter registered",
    );
  });
});
