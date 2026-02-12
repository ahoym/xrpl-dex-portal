"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "./modal-shell";
import type { XamanPayload } from "@/lib/hooks/use-wallet-adapter";

interface XamanSigningModalProps {
  payload: XamanPayload;
}

export function XamanSigningModal({ payload }: XamanSigningModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(payload.deeplink, { width: 256, margin: 2 }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      });
    });
    return () => { cancelled = true; };
  }, [payload.deeplink]);

  return (
    <ModalShell title="Sign with Xaman" onClose={() => {}}>
      <div className="mt-4 flex flex-col items-center gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Scan this QR code with your Xaman app to sign the transaction.
        </p>

        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Xaman QR Code"
            width={256}
            height={256}
            className="border border-zinc-200 dark:border-zinc-700"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center border border-zinc-200 dark:border-zinc-700">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600" />
          </div>
        )}

        <a
          href={payload.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 active:scale-[0.98]"
        >
          Open in Xaman
        </a>

        <div className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
          Waiting for signature...
        </div>
      </div>
    </ModalShell>
  );
}
