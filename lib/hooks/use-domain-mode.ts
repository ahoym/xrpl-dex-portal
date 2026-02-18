"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DOMAIN_ID_REGEX } from "@/lib/xrpl/constants";

const DOMAIN_STORAGE_KEY = "xrpl-dex-portal-domain";

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
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(() => typeof window !== "undefined");

  const setDomainID = useCallback(
    (id: string) => {
      if (!DOMAIN_ID_REGEX.test(id)) return;

      setDomainIDState(id);
      localStorage.setItem(DOMAIN_STORAGE_KEY, id);

      // Preserve existing query params (Amendment 2)
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("domain", id);
      router.replace(pathname + "?" + newParams.toString(), { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const clearDomain = useCallback(() => {
    setDomainIDState(null);
    localStorage.removeItem(DOMAIN_STORAGE_KEY);

    // Remove domain from URL while preserving other params (Amendment 2)
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("domain");
    const queryString = newParams.toString();
    router.replace(pathname + (queryString ? "?" + queryString : ""), { scroll: false });
  }, [searchParams, router, pathname]);

  const isActive = domainID !== null;

  return {
    domainID,
    setDomainID,
    clearDomain,
    expanded,
    setExpanded,
    isActive,
    hydrated,
  };
}
