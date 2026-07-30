"use client";

import { QRCodeSVG } from "qrcode.react";

/** Real, scannable PIX QR — renders the EMV copy-paste code (`pixCode`) as an actual QR Code. Used only in the deposit flow; `PseudoQr` (decorative, non-scannable) still covers the affiliate-link QR elsewhere. */
export function PixQr({ data, size = 200 }: { data: string; size?: number }) {
  return (
    <div className="bg-white rounded-xl p-3 shrink-0" style={{ width: size, height: size }}>
      {data && <QRCodeSVG value={data} size={size - 24} className="w-full h-full" level="M" />}
    </div>
  );
}
