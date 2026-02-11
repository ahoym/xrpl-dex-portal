"use client";

import type { PersistedState } from "@/lib/types";

interface SecurityWarningProps {
  network: PersistedState["network"];
}

export function SecurityWarning({ network }: SecurityWarningProps) {
  if (network === "mainnet") {
    return (
      <div className="rounded-md border border-red-400 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-950">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
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
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        <strong>Security notice:</strong> Wallet seeds are stored in your browser&apos;s
        localStorage for convenience. This is suitable for testnet/devnet experimentation.
      </p>
    </div>
  );
}
