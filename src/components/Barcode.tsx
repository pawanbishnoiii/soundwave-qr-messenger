import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({ value, height = 56 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: "CODE128", height, width: 1.8, displayValue: false, margin: 0, background: "transparent" });
  }, [value, height]);
  return <svg ref={ref} role="img" aria-label={`Barcode ${value}`} className="h-auto w-full max-w-full" />;
}
