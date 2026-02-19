"use client";

import { useMemo } from "react";
import { useApiFetch } from "./use-api-fetch";
import { useAccountCredentials } from "./use-account-credentials";
import { isCredentialExpired } from "../xrpl/credentials";
import type { PersistedState, AcceptedCredentialInfo } from "../types";

export type DomainAuthStatus = "authorized" | "unauthorized" | "loading" | "error";

interface DomainInfo {
  domainId: string;
  owner: string;
  acceptedCredentials: AcceptedCredentialInfo[];
}

export function useDomainAuthorization(
  domainId: string | undefined,
  address: string | undefined,
  network: PersistedState["network"],
  refreshKey: number,
): { status: DomainAuthStatus; credentialExpiresAtMs?: number } {
  const {
    data: domainData,
    loading: domainLoading,
    error: domainError,
  } = useApiFetch<DomainInfo>(
    () => {
      if (!domainId) return null;
      const params = new URLSearchParams({ network });
      return `/api/dex/domains/${encodeURIComponent(domainId)}?${params}`;
    },
    (json) => [json as unknown as DomainInfo],
    refreshKey,
  );

  const {
    credentials,
    loading: credLoading,
    error: credError,
  } = useAccountCredentials(address, network, refreshKey);

  return useMemo(() => {
    if (domainId === undefined) {
      return { status: "authorized" };
    }

    if (!address) {
      return { status: "authorized" };
    }

    if (domainLoading || credLoading) {
      return { status: "loading" };
    }

    if (domainError || credError) {
      return { status: "error" };
    }

    const domainInfo = domainData[0];

    if (!domainInfo) {
      return { status: "error" };
    }

    if (domainInfo.owner === address) {
      return { status: "authorized" };
    }

    const matchingCreds = credentials.filter(
      (cred) =>
        cred.accepted &&
        !isCredentialExpired(cred) &&
        domainInfo.acceptedCredentials.some(
          (ac) => ac.issuer === cred.issuer && ac.credentialType === cred.credentialType,
        ),
    );

    if (matchingCreds.length > 0) {
      const expiresValues = matchingCreds
        .map((c) => c.expiresAtMs)
        .filter((v): v is number => v !== undefined);
      const credentialExpiresAtMs =
        expiresValues.length > 0 ? Math.max(...expiresValues) : undefined;
      return { status: "authorized", credentialExpiresAtMs };
    }

    return { status: "unauthorized" };
  }, [
    domainId,
    address,
    domainLoading,
    credLoading,
    domainError,
    credError,
    domainData,
    credentials,
  ]);
}
