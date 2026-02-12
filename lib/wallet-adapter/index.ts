import type { WalletType } from "../types";
import type { WalletAdapter } from "./types";
import { SeedWalletAdapter } from "./seed-adapter";

export type { WalletAdapter, TxResult, PaymentParams, CreateOfferParams, CancelOfferParams, TrustlineParams } from "./types";

interface AdapterInfo {
  type: WalletType;
  displayName: string;
  /** Dynamic import for the adapter module (lazy-loaded to avoid bundle bloat). */
  load: () => Promise<{ new (...args: unknown[]): WalletAdapter }>;
}

/**
 * Registry of all known wallet adapters.
 * Extension adapters are lazily loaded only when selected.
 */
const ADAPTER_REGISTRY: AdapterInfo[] = [
  { type: "crossmark", displayName: "Crossmark", load: () => import("./crossmark-adapter").then(m => m.CrossmarkAdapter) },
  { type: "gemwallet", displayName: "GemWallet", load: () => import("./gemwallet-adapter").then(m => m.GemWalletAdapter) },
  // { type: "xaman", displayName: "Xaman", load: () => import("./xaman-adapter").then(m => m.XamanAdapter) },
  // { type: "metamask-snap", displayName: "MetaMask (XRPL)", load: () => import("./metamask-snap-adapter").then(m => m.MetaMaskSnapAdapter) },
];

/** Create a seed-based adapter. */
export function createSeedAdapter(getSeed: () => string): SeedWalletAdapter {
  return new SeedWalletAdapter(getSeed);
}

/** Get the list of extension wallet types that can be detected in the browser. */
export function getExtensionAdapterTypes(): AdapterInfo[] {
  return ADAPTER_REGISTRY;
}

/** Dynamically load and instantiate an extension adapter by type. */
export async function loadExtensionAdapter(type: WalletType): Promise<WalletAdapter> {
  const info = ADAPTER_REGISTRY.find((a) => a.type === type);
  if (!info) throw new Error(`No adapter registered for wallet type: ${type}`);
  const AdapterClass = await info.load();
  return new AdapterClass();
}
