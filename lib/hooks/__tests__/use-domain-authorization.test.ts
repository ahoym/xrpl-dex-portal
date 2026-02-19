import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDomainAuthorization } from "../use-domain-authorization";

vi.mock("../use-api-fetch", () => ({
  useApiFetch: vi.fn(),
}));

vi.mock("../use-account-credentials", () => ({
  useAccountCredentials: vi.fn(),
}));

import { useApiFetch } from "../use-api-fetch";
import { useAccountCredentials } from "../use-account-credentials";

const mockUseApiFetch = vi.mocked(useApiFetch);
const mockUseAccountCredentials = vi.mocked(useAccountCredentials);

const DOMAIN_ID = "A".repeat(64);
const WALLET_ADDRESS = "rTestWalletAddress123";
const OWNER_ADDRESS = "rDomainOwnerAddress456";

interface DomainInfo {
  domainId: string;
  owner: string;
  acceptedCredentials: { issuer: string; credentialType: string }[];
}

function mockDomain(data: DomainInfo | null, loading = false, error: string | null = null) {
  mockUseApiFetch.mockReturnValue({
    data: data ? [data] : [],
    loading,
    error,
    refresh: vi.fn(),
    refetch: vi.fn() as unknown as () => Promise<void>,
  });
}

function mockCredentials(
  creds: Array<{ issuer: string; credentialType: string; accepted: boolean; expiresAtMs?: number }>,
  loading = false,
  error: string | null = null,
) {
  mockUseAccountCredentials.mockReturnValue({
    credentials: creds,
    loading,
    error,
    refresh: vi.fn(),
    refetch: vi.fn() as unknown as () => Promise<void>,
  });
}

function renderAuth(domainId?: string, address?: string) {
  return renderHook(() =>
    useDomainAuthorization(domainId ?? DOMAIN_ID, address ?? WALLET_ADDRESS, "testnet", 0),
  );
}

describe("useDomainAuthorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns loading when domain data is loading", () => {
    mockDomain(null, true);
    mockCredentials([], false);
    const { result } = renderAuth();
    expect(result.current.status).toBe("loading");
  });

  it("returns authorized when wallet is domain owner", () => {
    mockDomain({ domainId: DOMAIN_ID, owner: WALLET_ADDRESS, acceptedCredentials: [] }, false);
    mockCredentials([]);
    const { result } = renderAuth(DOMAIN_ID, WALLET_ADDRESS);
    expect(result.current.status).toBe("authorized");
  });

  it("returns authorized with matching accepted non-expired credential", () => {
    mockDomain(
      {
        domainId: DOMAIN_ID,
        owner: OWNER_ADDRESS,
        acceptedCredentials: [{ issuer: "rIssuer123", credentialType: "KYC" }],
      },
      false,
    );
    mockCredentials([
      {
        issuer: "rIssuer123",
        credentialType: "KYC",
        accepted: true,
        expiresAtMs: Date.now() + 100000,
      },
    ]);
    const { result } = renderAuth();
    expect(result.current.status).toBe("authorized");
  });

  it("returns unauthorized when no matching credential", () => {
    mockDomain(
      {
        domainId: DOMAIN_ID,
        owner: OWNER_ADDRESS,
        acceptedCredentials: [{ issuer: "rIssuer123", credentialType: "KYC" }],
      },
      false,
    );
    mockCredentials([{ issuer: "rOtherIssuer", credentialType: "KYC", accepted: true }]);
    const { result } = renderAuth();
    expect(result.current.status).toBe("unauthorized");
  });

  it("returns unauthorized when credential is expired", () => {
    mockDomain(
      {
        domainId: DOMAIN_ID,
        owner: OWNER_ADDRESS,
        acceptedCredentials: [{ issuer: "rIssuer123", credentialType: "KYC" }],
      },
      false,
    );
    mockCredentials([
      {
        issuer: "rIssuer123",
        credentialType: "KYC",
        accepted: true,
        expiresAtMs: Date.now() - 10000,
      },
    ]);
    const { result } = renderAuth();
    expect(result.current.status).toBe("unauthorized");
  });

  it("returns unauthorized when credential is not accepted", () => {
    mockDomain(
      {
        domainId: DOMAIN_ID,
        owner: OWNER_ADDRESS,
        acceptedCredentials: [{ issuer: "rIssuer123", credentialType: "KYC" }],
      },
      false,
    );
    mockCredentials([{ issuer: "rIssuer123", credentialType: "KYC", accepted: false }]);
    const { result } = renderAuth();
    expect(result.current.status).toBe("unauthorized");
  });

  it("returns credentialExpiresAtMs from latest matching credential", () => {
    const earlier = Date.now() + 50000;
    const later = Date.now() + 100000;
    mockDomain(
      {
        domainId: DOMAIN_ID,
        owner: OWNER_ADDRESS,
        acceptedCredentials: [
          { issuer: "rIssuer123", credentialType: "KYC" },
          { issuer: "rIssuer456", credentialType: "AML" },
        ],
      },
      false,
    );
    mockCredentials([
      { issuer: "rIssuer123", credentialType: "KYC", accepted: true, expiresAtMs: earlier },
      { issuer: "rIssuer456", credentialType: "AML", accepted: true, expiresAtMs: later },
    ]);
    const { result } = renderAuth();
    expect(result.current.status).toBe("authorized");
    expect(result.current.credentialExpiresAtMs).toBe(later);
  });

  it("skips fetching when domainId is undefined", () => {
    mockDomain(null, false);
    mockCredentials([]);
    const { result } = renderHook(() =>
      useDomainAuthorization(undefined, WALLET_ADDRESS, "testnet", 0),
    );
    expect(result.current.status).toBe("authorized");
  });

  it("returns authorized when address is undefined", () => {
    mockDomain({ domainId: DOMAIN_ID, owner: OWNER_ADDRESS, acceptedCredentials: [] });
    mockCredentials([]);
    const { result } = renderHook(() => useDomainAuthorization(DOMAIN_ID, undefined, "testnet", 0));
    expect(result.current.status).toBe("authorized");
  });
});
