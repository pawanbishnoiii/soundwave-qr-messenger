import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M" }).then(setSrc);
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-muted" />;
  return <img src={src} width={size} height={size} alt={`QR code for ${value}`} className="rounded-lg" />;
}
