import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePollInterval } from "@/lib/hooks/use-poll-interval";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setPageVisible(visible: boolean) {
  Object.defineProperty(document, "visibilityState", {
    value: visible ? "visible" : "hidden",
    writable: true,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  setPageVisible(true);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usePollInterval", () => {
  it("calls callback at each interval tick", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePollInterval(callback, 3000, true));

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("does not call callback when enabled is false", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePollInterval(callback, 3000, false));

    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not call callback when the page is hidden", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePollInterval(callback, 3000, true));

    await act(async () => {
      setPageVisible(false);
    });

    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not overlap calls when previous is in-flight", async () => {
    let resolveInflight: () => void;
    const inflightPromise = new Promise<void>((r) => {
      resolveInflight = r;
    });
    const callback = vi.fn().mockReturnValueOnce(inflightPromise).mockResolvedValue(undefined);

    renderHook(() => usePollInterval(callback, 3000, true));

    // First tick starts the in-flight request
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Second tick skipped because first is still in-flight
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Resolve the in-flight request
    await act(async () => {
      resolveInflight!();
    });

    // Third tick should fire now
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("picks up latest callback via ref", async () => {
    const callbackA = vi.fn().mockResolvedValue(undefined);
    const callbackB = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(({ cb }) => usePollInterval(cb, 3000, true), {
      initialProps: { cb: callbackA },
    });

    // Update to new callback without changing enabled/intervalMs
    rerender({ cb: callbackB });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(callbackA).not.toHaveBeenCalled();
    expect(callbackB).toHaveBeenCalledTimes(1);
  });

  it("cleans up interval on unmount", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => usePollInterval(callback, 3000, true));

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("resets in-flight guard when deps change", async () => {
    // Start a request that never resolves
    const neverResolve = new Promise<void>(() => {});
    const callback = vi.fn().mockReturnValueOnce(neverResolve).mockResolvedValue(undefined);

    const { rerender } = renderHook(({ enabled }) => usePollInterval(callback, 3000, enabled), {
      initialProps: { enabled: true },
    });

    // First tick starts a never-resolving request
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Toggle enabled off and back on to restart the effect
    rerender({ enabled: false });
    rerender({ enabled: true });

    // Next tick should work because in-flight guard was reset
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
