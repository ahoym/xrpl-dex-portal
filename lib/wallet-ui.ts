/**
 * Shared UI utilities for wallet display (logos, names, etc.)
 */

import type { WalletType } from "./types";

export function getWalletLogo(type: WalletType): string {
  // Map wallet type to logo filename
  const logoMap: Record<WalletType, string> = {
    seed: "",
    crossmark: "crossmark",
    gemwallet: "gemwallet",
    xaman: "xaman",
    "metamask-snap": "metamask",
  };
  return logoMap[type] ? `/wallets/${logoMap[type]}.svg` : "";
}

export function getWalletDisplayName(type: WalletType): string {
  const nameMap: Record<WalletType, string> = {
    seed: "Seed",
    crossmark: "Crossmark",
    gemwallet: "GemWallet",
    xaman: "Xaman",
    "metamask-snap": "MetaMask",
  };
  return nameMap[type] ?? type;
}

/**
 * Return the appropriate loading text for a wallet signing action.
 * For hardware/extension wallets, prompts to confirm in the wallet app;
 * for seed wallets, shows a generic fallback like "Creating..." or "Sending...".
 */
export function getSigningLoadingText(
  adapter: { type: WalletType; displayName: string } | null,
  fallback: string = "Creating...",
): string {
  return adapter && adapter.type !== "seed"
    ? `Confirm in ${adapter.displayName}...`
    : fallback;
}

/**
 * Extract a human-readable error message from an unknown caught value.
 */
export function extractErrorMessage(err: unknown, fallback: string = "Network error"): string {
  return err instanceof Error ? err.message : fallback;
}
