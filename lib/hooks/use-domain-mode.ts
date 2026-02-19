"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";

const DOMAIN_STORAGE_KEY = "xrpl-dex-portal-domain";
const DOMAIN_ENABLED_KEY = "xrpl-dex-portal-domain-enabled";

export function useDomainMode() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [domainID, setDomainIDState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const urlDomain = searchParams.get("domain");
    if (urlDomain && DOMAIN_ID_REGEX.test(urlDomain)) return urlDomain;
    const stored = localStorage.getItem(DOMAIN_STORAGE_KEY);
    if (stored && DOMAIN_ID_REGEX.test(stored)) return stored;
    return null;
  });
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // If domain is in URL, enable by default
    const urlDomain = searchParams.get("domain");
    if (urlDomain && DOMAIN_ID_REGEX.test(urlDomain)) return true;
    return localStorage.getItem(DOMAIN_ENABLED_KEY) === "true";
  });
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(() => typeof window !== "undefined");

  const updateUrl = useCallback(
    (domainActive: boolean, id: string | null) => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (domainActive && id) {
        newParams.set("domain", id);
      } else {
        newParams.delete("domain");
      }
      const queryString = newParams.toString();
      router.replace(pathname + (queryString ? "?" + queryString : ""), { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setDomainID = useCallback(
    (id: string) => {
      if (!DOMAIN_ID_REGEX.test(id)) return;
      setDomainIDState(id);
      setEnabledState(true);
      localStorage.setItem(DOMAIN_STORAGE_KEY, id);
      localStorage.setItem(DOMAIN_ENABLED_KEY, "true");
      updateUrl(true, id);
    },
    [updateUrl],
  );

  const clearDomain = useCallback(() => {
    setDomainIDState(null);
    setEnabledState(false);
    localStorage.removeItem(DOMAIN_STORAGE_KEY);
    localStorage.removeItem(DOMAIN_ENABLED_KEY);
    updateUrl(false, null);
  }, [updateUrl]);

  const setEnabled = useCallback(
    (value: boolean) => {
      setEnabledState(value);
      localStorage.setItem(DOMAIN_ENABLED_KEY, String(value));
      updateUrl(value, domainID);
    },
    [updateUrl, domainID],
  );

  const isActive = domainID !== null && enabled;

  return {
    domainID,
    setDomainID,
    clearDomain,
    enabled,
    setEnabled,
    expanded,
    setExpanded,
    isActive,
    hydrated,
  };
}
