import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Store, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QrScanner } from "@/components/QrScanner";
import { parseScanned } from "@/lib/shipments";
import { playError, playSuccess, unlockAudio } from "@/lib/sound";
import pickupImg from "@/assets/rider-hero.png";
import { captureScanLocation } from "@/lib/location";

/** Daily pickup at the franchise store: scan many parcels in a row, each goes straight into the rider's bucket. */
export function StorePickupCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => { unlockAudio(); setOpen(true); }} className="relative block h-32 w-full overflow-hidden rounded-3xl text-left transition-transform active:scale-[0.98]">
        <img src={pickupImg} alt="" loading="lazy" className="absolute right-1 top-0 h-full w-36 object-contain" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative flex h-full flex-col justify-center p-5">
          <Store className="h-6 w-6 text-primary" />
          <p className="mt-2 text-lg font-bold">Receive at store</p>
          <p className="text-xs text-muted-foreground">Scan today's parcels in one go</p>
        </div>
      </button>
      {open && <PickupSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function PickupSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handle(text: string) {
    const code = parseScanned(text);
    if (busy || done.includes(code)) return;
    setBusy(true);
    let fix;
    try { fix = await captureScanLocation(); } catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Location required"); return; }
    const { error: e1 } = await supabase.rpc("claim_shipment", { _code: code });
    if (e1 && !/already/i.test(e1.message)) { playError(); toast.error(e1.message); setBusy(false); return; }
    const { error } = await supabase.rpc("scan_transition", { _code: code, _to: "out_for_delivery", _source: "store_pickup", _lat: fix.lat, _lng: fix.lng });
    setBusy(false);
    if (error) { playError(); toast.error(error.message); return; }
    playSuccess(); setDone((d) => [code, ...d]);
    qc.invalidateQueries({ queryKey: ["shipments"] });
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="mx-auto flex h-full max-w-md flex-col p-4">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Franchise store pickup</p><h2 className="text-2xl font-extrabold">{done.length} parcels loaded</h2></div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4"><QrScanner onScan={handle} paused={busy} /></div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Camera stays open — keep scanning. Each parcel goes into your delivery bucket.</p>
        <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
          {done.map((c) => <div key={c} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 font-mono text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />{c}</div>)}
        </div>
        <button onClick={onClose} className="mt-3 h-14 rounded-2xl bg-primary font-semibold text-primary-foreground">Done</button>
      </div>
    </div>
  );
}
