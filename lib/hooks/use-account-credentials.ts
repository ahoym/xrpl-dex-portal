"use client";

import { useApiFetch } from "./use-api-fetch";
import type { PersistedState, CredentialInfo } from "../types";

export function useAccountCredentials(
  address: string | undefined,
  network: PersistedState["network"],
  refreshKey: number,
) {
  const { data, loading, error, refresh, refetch } = useApiFetch<CredentialInfo>(
    () => {
      if (!address) return null;
      const params = new URLSearchParams({ network });
      return `/api/accounts/${encodeURIComponent(address)}/credentials?${params}`;
    },
    (json) => (json.credentials as CredentialInfo[]) ?? [],
    refreshKey,
  );

  return { credentials: data, loading, error, refresh, refetch };
}
