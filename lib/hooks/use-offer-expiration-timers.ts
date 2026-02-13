"use client";

import { useEffect, useRef } from "react";
import { fromRippleEpoch } from "@/lib/xrpl/constants";

/** Maximum time window (ms) for scheduling offer expiration timers. */
const MAX_EXPIRY_WINDOW_MS = 5 * 60 * 1000;

/** Buffer (ms) added after expiry before triggering refresh. */
const EXPIRY_BUFFER_MS = 1_000;

export interface ExpirableOffer {
  expiration?: number; // Ripple epoch seconds
}

/**
 * Schedules a single timer for the nearest-expiring offer within 5 minutes.
 * When it fires, calls `onExpire()`. The effect re-runs when `offers`
 * changes (e.g. after the refresh triggered by onExpire), naturally
 * picking up the next expiration. O(1) active timers at any time.
 */
export function useOfferExpirationTimers(offers: ExpirableOffer[], onExpire: () => void) {
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (offers.length === 0) return;

    const now = Date.now();
    let nearestDelay = Infinity;

    for (const offer of offers) {
      if (offer.expiration == null) continue;
      const expiresAt = fromRippleEpoch(offer.expiration).getTime();
      const delay = expiresAt - now;
      if (delay > 0 && delay <= MAX_EXPIRY_WINDOW_MS && delay < nearestDelay) {
        nearestDelay = delay;
      }
    }

    if (nearestDelay === Infinity) return;

    const timer = setTimeout(() => {
      onExpireRef.current();
    }, nearestDelay + EXPIRY_BUFFER_MS);

    return () => clearTimeout(timer);
  }, [offers]);
}
