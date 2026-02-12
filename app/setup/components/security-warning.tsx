"use client";

import type { PersistedState } from "@/lib/types";
import { useWalletAdapter } from "@/lib/hooks/use-wallet-adapter";

interface SecurityWarningProps {
  network: PersistedState["network"];
}

export function SecurityWarning({ network }: SecurityWarningProps) {
  const { adapter } = useWalletAdapter();
  const isExtensionWallet = adapter !== null && adapter.type !== "seed";

  if (isExtensionWallet) {
    return (
      <div className="border border-green-200 bg-green-50 px-5 py-4 shadow-sm dark:border-green-800 dark:bg-green-950/50">
        <p className="text-sm text-green-800 dark:text-green-200">
          <strong>Connected via {adapter.displayName}.</strong> Your keys are managed
          by the wallet extension — no seed is stored in this browser.
        </p>
      </div>
    );
  }

  if (network === "mainnet") {
    return (
      <div className="border border-red-300 bg-red-50 px-5 py-4 shadow-sm dark:border-red-800 dark:bg-red-950/50">
        <p className="text-sm font-bold text-red-700 dark:text-red-300">
          WARNING: You are on Mainnet. Real funds are at risk.
        </p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          Wallet seeds are stored in your browser&apos;s localStorage. This storage is not
          encrypted and can be accessed by browser extensions or XSS attacks. Only store
          funds you can afford to lose.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/50">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        <strong>Security notice:</strong> Wallet seeds are stored in your browser&apos;s
        localStorage for convenience. This is suitable for testnet/devnet experimentation.
      </p>
    </div>
  );
}
