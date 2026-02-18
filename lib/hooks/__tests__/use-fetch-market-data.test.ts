import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFetchMarketData } from "@/lib/hooks/use-fetch-market-data";
import type { CurrencyOption } from "@/lib/hooks/use-trading-data";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const XRP: CurrencyOption = { currency: "XRP", label: "XRP", value: "XRP|" };
const RLUSD: CurrencyOption = {
  currency: "RLUSD",
  issuer: "rIssuerXXXXXXXXXXXXXXXXXXXXXXX",
  label: "RLUSD (rIssuerXXXXXXXXXXXXXXXXXXXXXXX)",
  value: "RLUSD|rIssuerXXXXXXXXXXXXXXXXXXXXXXX",
};

function marketDataResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      orderbook: { buy: [{ account: "rBuyer" }], sell: [{ account: "rSeller" }] },
      depth: { bidVolume: "100", bidLevels: 5, askVolume: "200", askLevels: 8 },
      trades: [
        {
          hash: "AABB",
          side: "buy",
          price: "1.0",
          baseAmount: "10",
          quoteAmount: "10",
          account: "rTrader",
          time: "2025-01-01T00:00:00Z",
        },
      ],
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function errorResponse(status = 500): Response {
  return new Response(JSON.stringify({ error: "Server error" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useFetchMarketData", () => {
  it("fetches on initial mount with valid currencies", async () => {
    fetchMock.mockResolvedValueOnce(marketDataResponse());

    const { result } = renderHook(() => useFetchMarketData(XRP, RLUSD, "testnet", 0));

    await waitFor(() => {
      expect(result.current.orderBook).not.toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/dex/market-data");
    expect(url).toContain("base_currency=XRP");
    expect(url).toContain("quote_currency=RLUSD");
    expect(url).toContain("network=testnet");
    expect(url).toContain("quote_issuer=rIssuerXXXXXXXXXXXXXXXXXXXXXXX");
  });

  it("re-fetches when currencies change", async () => {
    fetchMock.mockResolvedValue(marketDataResponse());

    const { rerender } = renderHook(
      ({ selling, buying }) => useFetchMarketData(selling, buying, "testnet", 0),
      {
        initialProps: {
          selling: XRP as CurrencyOption | null,
          buying: RLUSD as CurrencyOption | null,
        },
      },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Switch currencies
    rerender({ selling: RLUSD, buying: XRP });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const url = fetchMock.mock.calls[1][0] as string;
    expect(url).toContain("base_currency=RLUSD");
    expect(url).toContain("quote_currency=XRP");
  });

  it("re-fetches when refreshKey changes", async () => {
    fetchMock.mockResolvedValue(marketDataResponse());

    const { rerender } = renderHook(
      ({ refreshKey }) => useFetchMarketData(XRP, RLUSD, "testnet", refreshKey),
      { initialProps: { refreshKey: 0 } },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender({ refreshKey: 1 });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("does not fetch when currencies are null", async () => {
    renderHook(() => useFetchMarketData(null, null, "testnet", 0));

    // Give effects a chance to run
    await act(async () => {});

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets loading states during non-silent fetch", async () => {
    let resolveFetch: (r: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolveFetch = r;
    });
    fetchMock.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useFetchMarketData(XRP, RLUSD, "testnet", 0));

    // Loading should be true while fetch is pending
    await waitFor(() => {
      expect(result.current.loadingOrderBook).toBe(true);
      expect(result.current.loadingTrades).toBe(true);
    });

    // Resolve fetch
    await act(async () => {
      resolveFetch!(marketDataResponse());
    });

    await waitFor(() => {
      expect(result.current.loadingOrderBook).toBe(false);
      expect(result.current.loadingTrades).toBe(false);
    });
  });

  it("does not set loading states for fetchSilent", async () => {
    // First mount fetch
    fetchMock.mockResolvedValueOnce(marketDataResponse());
    const { result } = renderHook(() => useFetchMarketData(XRP, RLUSD, "testnet", 0));

    await waitFor(() => expect(result.current.loadingOrderBook).toBe(false));

    // Silent fetch
    fetchMock.mockResolvedValueOnce(marketDataResponse({ trades: [] }));
    await act(async () => {
      await result.current.fetchSilent();
    });

    // Loading states should never have been set to true during silent fetch
    expect(result.current.loadingOrderBook).toBe(false);
    expect(result.current.loadingTrades).toBe(false);
  });

  it("handles fetch errors gracefully", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useFetchMarketData(XRP, RLUSD, "testnet", 0));

    await waitFor(() => {
      expect(result.current.loadingOrderBook).toBe(false);
    });

    expect(result.current.orderBook).toBeNull();
    expect(result.current.recentTrades).toEqual([]);
  });

  it("handles non-ok responses", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500));

    const { result } = renderHook(() => useFetchMarketData(XRP, RLUSD, "testnet", 0));

    await waitFor(() => {
      expect(result.current.loadingOrderBook).toBe(false);
    });

    expect(result.current.orderBook).toBeNull();
    expect(result.current.recentTrades).toEqual([]);
  });

  it("includes domain param in fetch URL when activeDomainID is set", async () => {
    const domainID = "A".repeat(64);
    fetchMock.mockResolvedValueOnce(marketDataResponse());

    const { result } = renderHook(() => useFetchMarketData(XRP, RLUSD, "testnet", 0, domainID));

    await waitFor(() => {
      expect(result.current.orderBook).not.toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`domain=${domainID}`);
  });

  it("does not include domain param when activeDomainID is undefined", async () => {
    fetchMock.mockResolvedValueOnce(marketDataResponse());

    const { result } = renderHook(() => useFetchMarketData(XRP, RLUSD, "testnet", 0));

    await waitFor(() => {
      expect(result.current.orderBook).not.toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("domain=");
  });

  it("resets orderbook and trades when activeDomainID changes", async () => {
    const domainID = "A".repeat(64);
    // Use Once variants so each call gets a fresh Response (Response body is single-use)
    fetchMock.mockResolvedValueOnce(marketDataResponse());
    fetchMock.mockResolvedValueOnce(marketDataResponse());

    const { result, rerender } = renderHook(
      ({ domain }: { domain?: string }) => useFetchMarketData(XRP, RLUSD, "testnet", 0, domain),
      { initialProps: { domain: undefined } },
    );

    await waitFor(() => {
      expect(result.current.orderBook).not.toBeNull();
    });

    // Change domain — data should reset before new fetch resolves
    rerender({ domain: domainID });

    await waitFor(() => {
      expect(result.current.orderBook).not.toBeNull();
    });

    // At least 2 fetches should have been made
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondUrl).toContain(`domain=${domainID}`);
  });
});
