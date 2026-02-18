"use client";

import { useState } from "react";
import type { WalletInfo, PersistedState, CredentialInfo } from "@/lib/types";
import { useAccountCredentials } from "@/lib/hooks/use-account-credentials";
import { useWalletAdapter } from "@/lib/hooks/use-wallet-adapter";
import { getSigningLoadingText, extractErrorMessage } from "@/lib/wallet-ui";
import { ExplorerLink } from "@/app/components/explorer-link";
import { cardClass, errorTextClass } from "@/lib/ui/ui";

interface CredentialManagementProps {
  wallet: WalletInfo;
  network: PersistedState["network"];
  refreshKey: number;
  onRefresh: () => void;
}

function isSafeHttpUrl(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isExpired(cred: CredentialInfo): boolean {
  return cred.expiresAtMs !== undefined && cred.expiresAtMs < Date.now();
}

export function CredentialManagement({
  wallet,
  network,
  refreshKey,
  onRefresh,
}: CredentialManagementProps) {
  const { adapter, acceptCredential, deleteCredential } = useWalletAdapter();
  const { credentials, loading, error } = useAccountCredentials(
    wallet.address,
    network,
    refreshKey,
  );

  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sort: pending first, then accepted. Within each group, alphabetical by credentialType.
  const sorted = [...credentials].sort((a, b) => {
    if (a.accepted !== b.accepted) return a.accepted ? 1 : -1;
    return a.credentialType.localeCompare(b.credentialType);
  });

  async function handleAccept(cred: CredentialInfo) {
    const key = `${cred.issuer}:${cred.credentialType}`;
    setActing(key);
    setActionError(null);
    try {
      const result = await acceptCredential({
        issuer: cred.issuer,
        credentialType: cred.credentialType,
        network,
      });
      if (!result.success) {
        setActionError(result.resultCode ?? "Failed to accept credential");
      } else {
        onRefresh();
      }
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActing(null);
    }
  }

  async function handleDelete(cred: CredentialInfo) {
    const key = `${cred.issuer}:${cred.credentialType}`;
    setActing(key);
    setActionError(null);
    try {
      const result = await deleteCredential({
        issuer: cred.issuer,
        credentialType: cred.credentialType,
        network,
      });
      if (!result.success) {
        setActionError(result.resultCode ?? "Failed to delete credential");
      } else {
        onRefresh();
      }
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActing(null);
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Credentials
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            Credentials issued to your wallet by third parties
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-xs font-semibold text-blue-600 hover:text-blue-500 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Refresh
        </button>
      </div>

      {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}

      {actionError && <p className={`mt-2 ${errorTextClass}`}>{actionError}</p>}

      {!loading && credentials.length === 0 && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No credentials found. Credentials are on-ledger attestations issued to
          your wallet by third parties (e.g., identity verifiers, compliance
          providers). When someone issues a credential to you, it will appear
          here for you to accept or reject.
        </p>
      )}

      {sorted.length > 0 && (
        <div className="mt-4 space-y-3">
          {sorted.map((cred) => {
            const key = `${cred.issuer}:${cred.credentialType}`;
            const expired = isExpired(cred);
            const isActing = acting === key;

            return (
              <div
                key={key}
                className={`border border-zinc-200 p-4 dark:border-zinc-700 ${expired ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {cred.credentialType}
                    </p>

                    <div className="mt-1">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Issuer:{" "}
                      </span>
                      <ExplorerLink address={cred.issuer} />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cred.accepted && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/40">
                          Accepted
                        </span>
                      )}
                      {!cred.accepted && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/40">
                          Pending
                        </span>
                      )}
                      {expired && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/40">
                          Expired
                        </span>
                      )}
                    </div>

                    {cred.expiresAtMs !== undefined && (
                      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {expired ? "Expired:" : "Expires:"}{" "}
                        {new Date(cred.expiresAtMs).toLocaleString()}
                      </p>
                    )}

                    {cred.uri && (
                      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        URI:{" "}
                        {isSafeHttpUrl(cred.uri) ? (
                          <a
                            href={cred.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={cred.uri}
                            className="max-w-xs truncate inline-block align-bottom text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {cred.uri}
                          </a>
                        ) : (
                          <span
                            title={cred.uri}
                            className="max-w-xs truncate inline-block align-bottom"
                          >
                            {cred.uri}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {!cred.accepted && !expired && (
                      <button
                        onClick={() => handleAccept(cred)}
                        disabled={isActing || acting !== null}
                        className="bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-sm disabled:active:scale-100"
                      >
                        {isActing
                          ? getSigningLoadingText(adapter, "Accepting...")
                          : "Accept"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(cred)}
                      disabled={isActing || acting !== null}
                      className="border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 hover:border-red-300 active:scale-[0.98] disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 dark:hover:border-red-700"
                    >
                      {isActing
                        ? getSigningLoadingText(adapter, "Deleting...")
                        : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
