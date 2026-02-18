import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplace = vi.fn();
let mockSearchParamsMap: Record<string, string> = {};

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamsMap[key] ?? null,
    toString: () => new URLSearchParams(mockSearchParamsMap).toString(),
  }),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/trade",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function importHook() {
  return import("@/lib/hooks/use-domain-mode").then((m) => m.useDomainMode);
}

const VALID_DOMAIN_ID = "A".repeat(64);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockReplace.mockReset();
  mockSearchParamsMap = {};
  localStorage.clear();
});

afterEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDomainMode", () => {
  it("returns null domainID and collapsed by default", async () => {
    const useDomainMode = await importHook();
    const { result } = renderHook(() => useDomainMode());

    expect(result.current.domainID).toBeNull();
    expect(result.current.expanded).toBe(false);
  });

  it("isActive is false when domainID is null", async () => {
    const useDomainMode = await importHook();
    const { result } = renderHook(() => useDomainMode());

    expect(result.current.isActive).toBe(false);
  });

  it("validates domain format — rejects lowercase", async () => {
    const useDomainMode = await importHook();
    const { result } = renderHook(() => useDomainMode());

    act(() => {
      result.current.setDomainID("a".repeat(64));
    });

    expect(result.current.domainID).toBeNull();
    expect(result.current.isActive).toBe(false);
  });

  it("validates domain format — rejects wrong length", async () => {
    const useDomainMode = await importHook();
    const { result } = renderHook(() => useDomainMode());

    act(() => {
      result.current.setDomainID("A".repeat(63));
    });

    expect(result.current.domainID).toBeNull();
    expect(result.current.isActive).toBe(false);
  });

  it("accepts a valid domain ID", async () => {
    const useDomainMode = await importHook();
    const { result } = renderHook(() => useDomainMode());

    act(() => {
      result.current.setDomainID(VALID_DOMAIN_ID);
    });

    expect(result.current.domainID).toBe(VALID_DOMAIN_ID);
    expect(result.current.isActive).toBe(true);
  });

  it("preserves existing query params when setting domain", async () => {
    mockSearchParamsMap = { base: "XRP", quote: "USD" };
    const useDomainMode = await importHook();
    const { result } = renderHook(() => useDomainMode());

    act(() => {
      result.current.setDomainID(VALID_DOMAIN_ID);
    });

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const calledUrl = mockReplace.mock.calls[0][0] as string;
    expect(calledUrl).toContain("base=XRP");
    expect(calledUrl).toContain(`domain=${VALID_DOMAIN_ID}`);
  });

  it("clearDomain sets domainID to null", async () => {
    const useDomainMode = await importHook();
    const { result } = renderHook(() => useDomainMode());

    act(() => {
      result.current.setDomainID(VALID_DOMAIN_ID);
    });
    expect(result.current.domainID).toBe(VALID_DOMAIN_ID);

    act(() => {
      result.current.clearDomain();
    });
    expect(result.current.domainID).toBeNull();
    expect(result.current.isActive).toBe(false);
  });

  it("setExpanded toggles expanded state", async () => {
    const useDomainMode = await importHook();
    const { result } = renderHook(() => useDomainMode());

    expect(result.current.expanded).toBe(false);

    act(() => {
      result.current.setExpanded(true);
    });

    expect(result.current.expanded).toBe(true);
  });
});
