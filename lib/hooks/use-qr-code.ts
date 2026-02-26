"use client";

import { useState, useEffect } from "react";

interface UseQRCodeOptions {
  width?: number;
  margin?: number;
}

/**
 * Generate a QR code data URL from a string value.
 * Returns null when value is null/undefined (QR code not needed).
 * Dynamically imports the qrcode library to avoid SSR issues.
 */
export function useQRCode(
  value: string | null | undefined,
  options: UseQRCodeOptions = {},
): { qrDataUrl: string | null; qrError: boolean } {
  const { width = 200, margin = 2 } = options;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!value) {
      setQrDataUrl(null);
      setQrError(false);
      return;
    }

    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(value, { width, margin }))
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, width, margin]);

  return { qrDataUrl, qrError };
}
