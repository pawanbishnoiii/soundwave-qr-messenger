import { useEffect, useRef, useState } from "react";
import { CameraOff, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { onScan: (text: string) => void; paused?: boolean };

/** Camera QR scanner. html5-qrcode is loaded only in the browser. */
export function QrScanner({ onScan, paused }: Props) {
  const id = useRef(`qr-${Math.random().toString(36).slice(2)}`);
  const scanner = useRef<any>(null);
  const cb = useRef(onScan);
  const pausedRef = useRef(paused);
  cb.current = onScan;
  pausedRef.current = paused;
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(id.current, {
          verbose: false,
          formatsToSupport: [F.QR_CODE, F.CODE_128, F.CODE_39, F.EAN_13, F.EAN_8, F.UPC_A, F.ITF],
          useBarCodeDetectorIfSupported: true,
        });
        scanner.current = s;
        await s.start(
          { facingMode: facing },
          { fps: 12, qrbox: (w: number, h: number) => ({ width: Math.floor(w * 0.85), height: Math.floor(h * 0.55) }) },
          (text: string) => { if (!pausedRef.current) cb.current(text); },
          () => {},
        );
        if (cancelled) { safeStop(s); return; }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      const s = scanner.current;
      scanner.current = null;
      if (s) safeStop(s);
    };
  }, [facing]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-navy">
      <div id={id.current} className="aspect-square w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      {!error && <div className="pointer-events-none absolute inset-x-[15%] h-0.5 bg-lime shadow-glow animate-scanline" />}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-navy-foreground">
          <div>
            <CameraOff className="mx-auto mb-3 h-10 w-10 opacity-70" />
            <p className="font-semibold">Camera not available</p>
            <p className="mt-1 text-sm opacity-70">Allow camera permission, or type the tracking code below.</p>
          </div>
        </div>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute right-3 top-3 rounded-full"
        onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
        aria-label="Switch camera"
      >
        <SwitchCamera />
      </Button>
    </div>
  );
}

function safeStop(s: { isScanning?: boolean; stop: () => Promise<void>; clear: () => void }) {
  try {
    if (!s.isScanning) return;
    s.stop().then(() => s.clear()).catch(() => {});
  } catch {
    /* scanner never started */
  }
}
