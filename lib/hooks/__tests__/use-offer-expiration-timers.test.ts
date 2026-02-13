import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOfferExpirationTimers } from "@/lib/hooks/use-offer-expiration-timers";
import { toRippleEpoch } from "@/lib/xrpl/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an offer that expires `ms` milliseconds from now. */
function makeOffer(expiresInMs: number) {
  return { expiration: toRippleEpoch(Date.now() + expiresInMs) };
}

/** Create an offer with no expiration. */
function makeOfferNoExpiry() {
  return {} as { expiration?: number };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useOfferExpirationTimers", () => {
  it("calls onExpire for the nearest expiring offer", async () => {
    const onExpire = vi.fn();
    const offers = [makeOffer(30_000), makeOffer(60_000)];

    renderHook(() => useOfferExpirationTimers(offers, onExpire));

    // Advance to nearest expiry (30s) + 1s buffer = 31s
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("does not set timer when no offers have expiration", async () => {
    const onExpire = vi.fn();
    const offers = [makeOfferNoExpiry(), makeOfferNoExpiry()];

    renderHook(() => useOfferExpirationTimers(offers, onExpire));

    await act(async () => {
      vi.advanceTimersByTime(600_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("does not set timer when offers list is empty", async () => {
    const onExpire = vi.fn();

    renderHook(() => useOfferExpirationTimers([], onExpire));

    await act(async () => {
      vi.advanceTimersByTime(600_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("does not set timer for already-expired offers", async () => {
    const onExpire = vi.fn();
    // Offer that expired 10 seconds ago
    const offers = [makeOffer(-10_000)];

    renderHook(() => useOfferExpirationTimers(offers, onExpire));

    await act(async () => {
      vi.advanceTimersByTime(600_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("does not set timer for offers more than 5 minutes away", async () => {
    const onExpire = vi.fn();
    // Offer that expires in 6 minutes
    const offers = [makeOffer(6 * 60 * 1000)];

    renderHook(() => useOfferExpirationTimers(offers, onExpire));

    await act(async () => {
      vi.advanceTimersByTime(7 * 60 * 1000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("fires exactly once regardless of offer count", async () => {
    const onExpire = vi.fn();
    // 5 offers all expiring at different times within 5 minutes
    const offers = [
      makeOffer(10_000),
      makeOffer(20_000),
      makeOffer(30_000),
      makeOffer(40_000),
      makeOffer(50_000),
    ];

    renderHook(() => useOfferExpirationTimers(offers, onExpire));

    // Advance past all expirations + buffer
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    // Only 1 call — single-next-timer approach fires for the nearest only
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("cleans up timer on unmount", async () => {
    const onExpire = vi.fn();
    const offers = [makeOffer(30_000)];

    const { unmount } = renderHook(() => useOfferExpirationTimers(offers, onExpire));

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("resets timer when offers change to nearer expiration", async () => {
    const onExpire = vi.fn();
    const farOffers = [makeOffer(60_000)];
    const nearOffers = [makeOffer(10_000)];

    const { rerender } = renderHook(({ offers }) => useOfferExpirationTimers(offers, onExpire), {
      initialProps: { offers: farOffers },
    });

    // Switch to nearer offer
    rerender({ offers: nearOffers });

    // Advance to near offer expiry (10s) + 1s buffer
    await act(async () => {
      vi.advanceTimersByTime(11_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
