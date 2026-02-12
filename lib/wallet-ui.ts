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
