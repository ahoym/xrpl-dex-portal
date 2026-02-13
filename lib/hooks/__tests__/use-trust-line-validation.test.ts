import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTrustLineValidation } from "@/lib/hooks/use-trust-line-validation";
import { LSF_DEFAULT_RIPPLE } from "@/lib/xrpl/constants";
import type { BalanceEntry } from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SENDER_ADDRESS = "rSenderXXXXXXXXXXXXXXXXXXXXXXX";
const DEST_ADDRESS = "rDestXXXXXXXXXXXXXXXXXXXXXXXXXX";
const ISSUER_ADDRESS = "rIssuerXXXXXXXXXXXXXXXXXXXXXXX";
const NETWORK = "testnet";

/** Standard 3-char currency balance. */
const usdBalance: BalanceEntry = {
  currency: "USD",
  value: "100",
  issuer: ISSUER_ADDRESS,
};

/** Non-standard (hex-encoded) currency balance. */
const rlusdBalance: BalanceEntry = {
  currency: "RLUSD",
  value: "50",
  issuer: ISSUER_ADDRESS,
};

/** XRP balance (no issuer). */
const xrpBalance: BalanceEntry = {
  currency: "XRP",
  value: "1000",
};

/** 40-char hex encoding for "RLUSD". */
const RLUSD_HEX = "524C555344000000000000000000000000000000";

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
// Helpers
// ---------------------------------------------------------------------------

/** Build a successful trust-lines API response. */
function trustLinesResponse(trustLines: { currency: string; account: string }[]): Response {
  return new Response(JSON.stringify({ trustLines }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a successful account-info API response with given flags. */
function accountInfoResponse(flags: number): Response {
  return new Response(JSON.stringify({ account_data: { Flags: flags } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a failed (non-ok) response. */
function errorResponse(status = 500): Response {
  return new Response(JSON.stringify({ error: "Server error" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Default hook params for an issued-currency transfer. */
function defaultParams(overrides?: Partial<Parameters<typeof useTrustLineValidation>[0]>) {
  return {
    selectedBalance: usdBalance,
    destinationAddress: DEST_ADDRESS,
    network: NETWORK,
    senderAddress: SENDER_ADDRESS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTrustLineValidation", () => {
  // =========================================================================
  // Early-exit paths (no fetch calls)
  // =========================================================================

  describe("early exits", () => {
    it("returns all nulls and no loading when selectedBalance is null", () => {
      const { result } = renderHook(() =>
        useTrustLineValidation(defaultParams({ selectedBalance: null })),
      );

      expect(result.current.trustLineOk).toBeNull();
      expect(result.current.ripplingOk).toBeNull();
      expect(result.current.checkingTrustLine).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("skips validation for XRP transfers", () => {
      const { result } = renderHook(() =>
        useTrustLineValidation(defaultParams({ selectedBalance: xrpBalance })),
      );

      expect(result.current.trustLineOk).toBeNull();
      expect(result.current.ripplingOk).toBeNull();
      expect(result.current.checkingTrustLine).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("resets state when destinationAddress becomes empty", () => {
      const { result } = renderHook(() =>
        useTrustLineValidation(defaultParams({ destinationAddress: "" })),
      );

      expect(result.current.trustLineOk).toBeNull();
      expect(result.current.ripplingOk).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sets trustLineOk=true and skips fetch when sending to the issuer (burn)", () => {
      const { result } = renderHook(() =>
        useTrustLineValidation(defaultParams({ destinationAddress: ISSUER_ADDRESS })),
      );

      expect(result.current.trustLineOk).toBe(true);
      expect(result.current.ripplingOk).toBeNull();
      expect(result.current.checkingTrustLine).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Trust line match detection
  // =========================================================================

  describe("trust line match detection", () => {
    it("detects a matching trust line by standard 3-char currency code", async () => {
      fetchMock.mockResolvedValueOnce(
        trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]),
      );

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(true);
    });

    it("detects a matching trust line via hex-decoded currency code", async () => {
      // The trust line has the hex-encoded form; the selected balance has "RLUSD".
      // decodeCurrency("524C5553...") returns "RLUSD", so it should match.
      fetchMock.mockResolvedValueOnce(
        trustLinesResponse([{ currency: RLUSD_HEX, account: ISSUER_ADDRESS }]),
      );

      const { result } = renderHook(() =>
        useTrustLineValidation(defaultParams({ selectedBalance: rlusdBalance })),
      );

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(true);
    });

    it("returns trustLineOk=false when no trust line matches", async () => {
      fetchMock.mockResolvedValueOnce(
        trustLinesResponse([
          { currency: "EUR", account: ISSUER_ADDRESS },
          { currency: "USD", account: "rSomeOtherIssuerXXXXXXXXXXXXXXX" },
        ]),
      );

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(false);
    });

    it("returns trustLineOk=false when trust lines array is empty", async () => {
      fetchMock.mockResolvedValueOnce(trustLinesResponse([]));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(false);
    });

    it("requires both currency AND account (issuer) to match", async () => {
      // Currency matches but issuer is different
      fetchMock.mockResolvedValueOnce(
        trustLinesResponse([{ currency: "USD", account: "rDifferentIssuerXXXXXXXXXXXXXXX" }]),
      );

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(false);
    });

    it("handles response with missing trustLines key (defaults to empty array)", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(false);
    });
  });

  // =========================================================================
  // Issuer account existence / rippling check
  // =========================================================================

  describe("rippling check", () => {
    it("checks rippling when trust line matches and sender is not the issuer", async () => {
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockResolvedValueOnce(accountInfoResponse(LSF_DEFAULT_RIPPLE));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(true);
      expect(result.current.ripplingOk).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("sets ripplingOk=false when DefaultRipple flag is not set", async () => {
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockResolvedValueOnce(accountInfoResponse(0));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(true);
      expect(result.current.ripplingOk).toBe(false);
    });

    it("detects DefaultRipple among other flags via bitwise check", async () => {
      const combinedFlags = LSF_DEFAULT_RIPPLE | 0x00100000; // DefaultRipple + some other flag
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockResolvedValueOnce(accountInfoResponse(combinedFlags));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.ripplingOk).toBe(true);
    });

    it("skips rippling check when sender IS the issuer", async () => {
      fetchMock.mockResolvedValueOnce(
        trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]),
      );

      const { result } = renderHook(() =>
        useTrustLineValidation(defaultParams({ senderAddress: ISSUER_ADDRESS })),
      );

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(true);
      expect(result.current.ripplingOk).toBeNull();
      // Only one fetch call (trust lines), no account info call
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("skips rippling check when trust line does not match", async () => {
      fetchMock.mockResolvedValueOnce(trustLinesResponse([]));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(false);
      expect(result.current.ripplingOk).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("leaves ripplingOk as null when issuer account info fetch fails", async () => {
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(true);
      expect(result.current.ripplingOk).toBeNull();
    });

    it("leaves ripplingOk as null when issuer account info returns non-ok", async () => {
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockResolvedValueOnce(errorResponse(404));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBe(true);
      expect(result.current.ripplingOk).toBeNull();
    });

    it("defaults to flags=0 when account_data.Flags is missing", async () => {
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ account_data: {} }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.ripplingOk).toBe(false);
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe("error handling", () => {
    it("sets trustLineOk=null when trust lines fetch returns non-ok", async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(500));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBeNull();
    });

    it("sets trustLineOk=null when trust lines fetch throws", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(result.current.trustLineOk).toBeNull();
    });
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  describe("loading state", () => {
    it("sets checkingTrustLine=true while fetching", async () => {
      let resolveFetch!: (value: Response) => void;
      fetchMock.mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(true);
      });

      // Resolve the fetch to complete
      await act(async () => {
        resolveFetch(trustLinesResponse([]));
      });

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });
    });
  });

  // =========================================================================
  // Cancellation behavior
  // =========================================================================

  describe("cancellation", () => {
    it("ignores stale trust-line response when dependencies change", async () => {
      let resolveFirst!: (value: Response) => void;
      const firstFetchPromise = new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });

      // First render: fetch starts but doesn't resolve yet
      fetchMock.mockReturnValueOnce(firstFetchPromise);

      const { result, rerender } = renderHook((props) => useTrustLineValidation(props), {
        initialProps: defaultParams(),
      });

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(true);
      });

      // Second fetch for the new destination
      fetchMock.mockResolvedValueOnce(
        trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]),
      );

      // Change destination, triggering cleanup of first effect + new effect
      rerender(defaultParams({ destinationAddress: "rNewDestXXXXXXXXXXXXXXXXXXXXXXX" }));

      // Wait for second fetch to settle
      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      // Now resolve the first (stale) fetch -- it should be ignored
      await act(async () => {
        resolveFirst(trustLinesResponse([]));
      });

      // trustLineOk should reflect the second fetch (match found), not the stale first
      expect(result.current.trustLineOk).toBe(true);
    });

    it("ignores stale rippling response when dependencies change", async () => {
      let resolveIssuerFetch!: (value: Response) => void;
      const issuerFetchPromise = new Promise<Response>((resolve) => {
        resolveIssuerFetch = resolve;
      });

      // First render: trust line fetch resolves immediately, issuer fetch hangs
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockReturnValueOnce(issuerFetchPromise);

      const { result, rerender } = renderHook((props) => useTrustLineValidation(props), {
        initialProps: defaultParams(),
      });

      // Wait for the trust line check to start (issuer fetch is still pending)
      await waitFor(() => {
        expect(result.current.trustLineOk).toBe(true);
      });

      // Change to XRP (which resets everything via early exit)
      rerender(defaultParams({ selectedBalance: xrpBalance }));

      // Now resolve the stale issuer fetch -- it should be ignored
      await act(async () => {
        resolveIssuerFetch(accountInfoResponse(LSF_DEFAULT_RIPPLE));
      });

      // ripplingOk should still be null (reset by XRP early exit), not true
      expect(result.current.ripplingOk).toBeNull();
    });
  });

  // =========================================================================
  // API URL construction
  // =========================================================================

  describe("API URL construction", () => {
    it("passes the correct trust-lines URL with encoded address and network", async () => {
      fetchMock.mockResolvedValueOnce(trustLinesResponse([]));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/accounts/${encodeURIComponent(DEST_ADDRESS)}/trustlines?network=${NETWORK}`,
      );
    });

    it("passes the correct issuer account-info URL", async () => {
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockResolvedValueOnce(accountInfoResponse(LSF_DEFAULT_RIPPLE));

      const { result } = renderHook(() => useTrustLineValidation(defaultParams()));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/accounts/${encodeURIComponent(ISSUER_ADDRESS)}?network=${NETWORK}`,
      );
    });
  });

  // =========================================================================
  // Re-validation on dependency changes
  // =========================================================================

  describe("re-validation on dependency changes", () => {
    it("re-fetches when selectedBalance changes", async () => {
      // First render: USD trust line exists; also triggers rippling check
      fetchMock
        .mockResolvedValueOnce(trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]))
        .mockResolvedValueOnce(accountInfoResponse(LSF_DEFAULT_RIPPLE));

      const { result, rerender } = renderHook((props) => useTrustLineValidation(props), {
        initialProps: defaultParams(),
      });

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });
      expect(result.current.trustLineOk).toBe(true);

      // Second fetch: change to RLUSD, no trust line
      fetchMock.mockResolvedValueOnce(trustLinesResponse([]));

      rerender(defaultParams({ selectedBalance: rlusdBalance }));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });
      expect(result.current.trustLineOk).toBe(false);
      // 2 fetches for first render (trust lines + rippling) + 1 for rerender
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("re-fetches when network changes", async () => {
      fetchMock.mockResolvedValueOnce(
        trustLinesResponse([{ currency: "USD", account: ISSUER_ADDRESS }]),
      );

      const { result, rerender } = renderHook((props) => useTrustLineValidation(props), {
        initialProps: defaultParams(),
      });

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      fetchMock.mockResolvedValueOnce(trustLinesResponse([]));
      rerender(defaultParams({ network: "mainnet" }));

      await waitFor(() => {
        expect(result.current.checkingTrustLine).toBe(false);
      });

      // Verify the second fetch used the new network
      expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("network=mainnet"));
    });
  });
});
