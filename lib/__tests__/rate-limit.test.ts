import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request for a new key", () => {
    const result = rateLimit("first-request", 5, 1000);
    expect(result).toEqual({ allowed: true });
  });

  it("allows a burst of requests up to max", () => {
    const max = 5;
    const key = "burst-capacity";

    for (let i = 0; i < max; i++) {
      const result = rateLimit(key, max, 1000);
      expect(result).toEqual({ allowed: true });
    }
  });

  it("rejects the request exceeding max (max+1th request)", () => {
    const max = 5;
    const key = "exceed-limit";

    // Consume all tokens
    for (let i = 0; i < max; i++) {
      rateLimit(key, max, 1000);
    }

    // The next request should be rejected
    const result = rateLimit(key, max, 1000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("allows requests again after tokens refill (full window elapsed)", () => {
    const max = 5;
    const windowMs = 1000;
    const key = "token-refill";

    // Exhaust all tokens
    for (let i = 0; i < max; i++) {
      rateLimit(key, max, windowMs);
    }

    // Verify exhausted
    const exhausted = rateLimit(key, max, windowMs);
    expect(exhausted.allowed).toBe(false);

    // Wait for a full window — should refill all tokens
    vi.advanceTimersByTime(windowMs);

    const result = rateLimit(key, max, windowMs);
    expect(result).toEqual({ allowed: true });
  });

  it("partially refills tokens when less than a full window elapses", () => {
    const max = 5;
    const windowMs = 1000;
    const key = "partial-refill";

    // Exhaust all tokens
    for (let i = 0; i < max; i++) {
      rateLimit(key, max, windowMs);
    }

    // Wait for 1/5 of the window — should refill exactly 1 token (5 * 200/1000 = 1)
    vi.advanceTimersByTime(windowMs / max);

    const result = rateLimit(key, max, windowMs);
    expect(result).toEqual({ allowed: true });

    // But the next request should be rejected (only 1 token was refilled and we just used it)
    const next = rateLimit(key, max, windowMs);
    expect(next.allowed).toBe(false);
  });

  it("returns a reasonable retryAfterMs value (> 0 and <= windowMs)", () => {
    const max = 5;
    const windowMs = 1000;
    const key = "retry-after-calc";

    // Exhaust all tokens
    for (let i = 0; i < max; i++) {
      rateLimit(key, max, windowMs);
    }

    const result = rateLimit(key, max, windowMs);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(windowMs);
    }
  });

  it("computes retryAfterMs correctly based on token deficit", () => {
    const max = 5;
    const windowMs = 1000;
    const key = "retry-after-exact";

    // Exhaust all tokens
    for (let i = 0; i < max; i++) {
      rateLimit(key, max, windowMs);
    }

    // After exhausting max tokens, bucket has 0 tokens.
    // Need 1 token → deficit = 1 - 0 = 1.
    // retryAfterMs = ceil((1 / 5) * 1000) = 200
    const result = rateLimit(key, max, windowMs);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBe(200);
    }
  });

  it("maintains independent buckets for different keys", () => {
    const max = 3;
    const windowMs = 1000;

    // Exhaust key A
    for (let i = 0; i < max; i++) {
      rateLimit("independent-a", max, windowMs);
    }
    const resultA = rateLimit("independent-a", max, windowMs);
    expect(resultA.allowed).toBe(false);

    // Key B should still be fresh
    const resultB = rateLimit("independent-b", max, windowMs);
    expect(resultB).toEqual({ allowed: true });
  });

  it("caps tokens at max even after a long wait", () => {
    const max = 3;
    const windowMs = 1000;
    const key = "token-cap";

    // First request: creates bucket with max-1 = 2 tokens
    rateLimit(key, max, windowMs);

    // Wait a very long time (10x the window)
    vi.advanceTimersByTime(windowMs * 10);

    // Should still only allow max total before being rejected
    // After long wait, tokens should refill to max (capped).
    // First call after wait: refill to max, consume 1 → max-1 tokens left
    for (let i = 0; i < max; i++) {
      const result = rateLimit(key, max, windowMs);
      expect(result).toEqual({ allowed: true });
    }

    // The next one should be rejected — tokens don't exceed max
    const rejected = rateLimit(key, max, windowMs);
    expect(rejected.allowed).toBe(false);
  });

  it("allows exactly max requests with max=1", () => {
    const key = "max-one";
    const result1 = rateLimit(key, 1, 1000);
    expect(result1).toEqual({ allowed: true });

    const result2 = rateLimit(key, 1, 1000);
    expect(result2.allowed).toBe(false);

    // After waiting the full window, should be allowed again
    vi.advanceTimersByTime(1000);
    const result3 = rateLimit(key, 1, 1000);
    expect(result3).toEqual({ allowed: true });
  });

  it("handles multiple partial refill cycles correctly", () => {
    const max = 10;
    const windowMs = 1000;
    const key = "multi-partial";

    // Exhaust all tokens
    for (let i = 0; i < max; i++) {
      rateLimit(key, max, windowMs);
    }

    // Confirm exhausted
    expect(rateLimit(key, max, windowMs).allowed).toBe(false);

    // Advance enough time to refill 3 tokens (300ms = 3/10 of window → 3 tokens)
    vi.advanceTimersByTime(300);

    // Should allow 3 requests
    for (let i = 0; i < 3; i++) {
      const result = rateLimit(key, max, windowMs);
      expect(result).toEqual({ allowed: true });
    }

    // The 4th should be rejected
    expect(rateLimit(key, max, windowMs).allowed).toBe(false);
  });
});
